import { Notice, TFile } from "obsidian";
import JiraPlugin from "../main";
import { fetchIssue, createJiraIssue } from "../api";
import { fetchCreateMetaFields } from "../api/projects";
import { createOrUpdateIssueNote } from "../file_operations/getIssue";
import { checkCommandCallback } from "../tools/checkCommandCallback";
import { useTranslations } from "../localization/translator";
import { debugLog } from "../tools/debugLogging";

const t = useTranslations("commands.clone_issue").t;

export function registerCloneIssueCommand(plugin: JiraPlugin): void {
	plugin.addCommand({
		id: "clone-issue-jira",
		name: t("name"),
		checkCallback: (checking: boolean) => {
			return checkCommandCallback(
				plugin,
				checking,
				cloneIssueCallback,
				["key"],
				["key"],
			);
		},
	});
}

// Fields that are read-only or computed — never send to Jira on create
const SKIP_FIELDS = new Set([
	"status",
	"resolution",
	"resolutiondate",
	"created",
	"updated",
	"lastViewed",
	"creator",
	"reporter",
	"watches",
	"votes",
	"worklog",
	"comment",
	"issuelinks",
	"subtasks",
	"attachment",
	"progress",
	"aggregateprogress",
	"workratio",
	"timespent",
	"aggregatetimespent",
	"timeestimate",
	"aggregatetimeestimate",
	"aggregatetimeoriginalestimate",
	"timetracking",
	"archiveddate",
	"archivedby",
	"environment",
]);

/**
 * Parse sprint ID from Jira API v2 string representation.
 * Format: "com.atlassian.greenhopper.service.sprint.Sprint@...[id=7894,...,state=ACTIVE,...]"
 */
function parseSprintIdFromString(sprintStr: string): number | null {
	const match = sprintStr.match(/\bid=(\d+)\b/);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Find the active (or last) sprint ID from an array of sprint strings.
 */
function extractSprintId(sprintValues: string[]): number | null {
	// Prefer ACTIVE sprint, fallback to last one
	for (const str of sprintValues) {
		if (str.includes("state=ACTIVE")) {
			return parseSprintIdFromString(str);
		}
	}
	// No active sprint found, use the last one
	if (sprintValues.length > 0) {
		return parseSprintIdFromString(sprintValues[sprintValues.length - 1]);
	}
	return null;
}

/**
 * Check if a string array looks like sprint data from Jira API v2.
 */
function isSprintStringArray(value: any): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		typeof value[0] === "string" &&
		value[0].includes("com.atlassian.greenhopper.service.sprint.Sprint")
	);
}

/**
 * Check if a string array looks like Insight/Assets field values.
 * Format: ["Some Name (KEY-12345)"]
 */
function isInsightStringArray(value: any): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		typeof value[0] === "string" &&
		/\([A-Z]+-\d+\)$/.test(value[0].trim())
	);
}

/**
 * Convert Insight string values to objects with keys.
 * "BCC Business (IAS-57431)" -> { key: "IAS-57431" }
 */
function parseInsightValues(values: string[]): { key: string }[] {
	return values
		.map((v) => {
			const match = v.match(/\(([A-Z]+-\d+)\)\s*$/);
			return match ? { key: match[1] } : null;
		})
		.filter((v): v is { key: string } => v !== null);
}

/**
 * Transform a field value for the create issue API.
 * Handles special formats that Jira returns differently from what it accepts.
 */
function transformFieldValue(key: string, value: any): any {
	if (value === null || value === undefined) return value;

	// Sprint fields (API v2 returns string representations)
	if (isSprintStringArray(value)) {
		const sprintId = extractSprintId(value);
		return sprintId;
	}

	// Sprint as object array (API v3 or some configurations)
	if (
		Array.isArray(value) &&
		value.length > 0 &&
		typeof value[0] === "object" &&
		"state" in value[0]
	) {
		const active =
			value.find((s: any) => s.state === "ACTIVE") ||
			value[value.length - 1];
		return active.id;
	}

	// Sprint as single object
	if (
		typeof value === "object" &&
		!Array.isArray(value) &&
		"state" in value &&
		"id" in value
	) {
		return value.id;
	}

	// Insight/Assets fields (string array with keys in parentheses)
	if (isInsightStringArray(value)) {
		return parseInsightValues(value);
	}

	return value;
}

async function cloneIssueCallback(
	plugin: JiraPlugin,
	file: TFile,
	issueKey: string,
): Promise<void> {
	try {
		const issue = await fetchIssue(plugin, issueKey);

		// Fetch which fields are allowed on the create screen for this project+issuetype
		const issuetypeField = issue.fields.issuetype as Record<string, any>;
		const issueTypeId = issuetypeField.id || issuetypeField.name;
		const allowedFields = await fetchCreateMetaFields(
			plugin,
			issue.fields.project.key,
			issueTypeId,
		);

		const cloneFields: Record<string, any> = {
			project: { key: issue.fields.project.key },
			issuetype: { name: issue.fields.issuetype.name },
			summary: `CLONE - ${issue.fields.summary}`,
		};

		// Copy all fields from original, filtered by what Jira allows on create screen
		for (const [key, value] of Object.entries(issue.fields)) {
			if (key in cloneFields) continue;
			if (SKIP_FIELDS.has(key)) continue;
			if (value === null || value === undefined) continue;
			if (!allowedFields.has(key)) continue;

			const transformed = transformFieldValue(key, value);
			if (transformed !== null && transformed !== undefined) {
				cloneFields[key] = transformed;
			}
		}

		debugLog("Clone fields:", cloneFields);

		const newIssue = await createJiraIssue(plugin, cloneFields);
		const fullNewIssue = await fetchIssue(plugin, newIssue.key);
		await createOrUpdateIssueNote(plugin, fullNewIssue);

		new Notice(t("success", { issueKey: newIssue.key }));
	} catch (error) {
		new Notice(
			t("error") + ": " + (error.message || "Unknown error"),
			3000,
		);
		console.error(error);
	}
}
