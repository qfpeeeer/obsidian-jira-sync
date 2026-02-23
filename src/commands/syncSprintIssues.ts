import JiraPlugin from "../main";
import {validateSettings} from "../api";
import {batchFetchAndCreateIssues} from "./batchFetchIssues";
import {useTranslations} from "../localization/translator";

const t = useTranslations("commands.sync_sprint_issues").t;

const SPRINT_JQL = 'sprint in openSprints() AND assignee = currentUser() order by priority DESC';

export function registerSyncSprintIssuesCommand(plugin: JiraPlugin): void {
	plugin.addCommand({
		id: "sync-sprint-issues-jira",
		name: t("name"),
		checkCallback: (checking: boolean) => {
			const settings_are_valid = validateSettings(plugin);
			if (settings_are_valid) {
				if (!checking) batchFetchAndCreateIssues(plugin, SPRINT_JQL);
				return true;
			}
			return false;
		},
	});
}
