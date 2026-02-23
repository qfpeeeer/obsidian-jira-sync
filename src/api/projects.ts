import JiraPlugin from "../main";
import { baseRequest } from "./base";

export async function fetchProjects(
	plugin: JiraPlugin,
): Promise<Record<string, any>[]> {
	return await baseRequest(plugin, "get", "/project");
}

export async function fetchIssueTypes(
	plugin: JiraPlugin,
	projectKey: string,
): Promise<Record<string, any>> {
	return await baseRequest(
		plugin,
		"get",
		`/issue/createmeta/${projectKey}/issuetypes`,
	);
}

export async function fetchCreateMetaFields(
	plugin: JiraPlugin,
	projectKey: string,
	issueTypeId: string,
): Promise<Set<string>> {
	let allFields: any[] = [];
	let startAt = 0;
	const maxResults = 50;

	while (true) {
		const result = await baseRequest(
			plugin,
			"get",
			`/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`,
			undefined,
			{ startAt, maxResults },
		);
		const values = result.values || [];
		allFields = [...allFields, ...values];
		if (
			values.length < maxResults ||
			allFields.length >= (result.total || allFields.length)
		) {
			break;
		}
		startAt += values.length;
	}

	return new Set(allFields.map((f: any) => f.fieldId));
}
