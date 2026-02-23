import JiraPlugin from "../main";
import { Vault } from "obsidian";

/**
 * Ensure the issues folder exists
 */
export async function ensureIssuesFolder(plugin: JiraPlugin): Promise<void> {
	await ensureFolder(plugin.app.vault, plugin.settings.global.issuesFolder);
}

/**
 * Ensure a folder (and all parent folders) exists in the vault
 */
export async function ensureFolder(
	vault: Vault,
	folderPath: string,
): Promise<void> {
	if (!folderPath) return;
	const folder = vault.getFolderByPath(folderPath);
	if (!folder) {
		await vault.createFolder(folderPath);
	}
}

/**
 * Capitalize the first letter of a string
 * @param str The string to capitalize
 * @returns The capitalized string
 */
export function capitalizeFirstLetter(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
