import { Plugin } from 'obsidian'
import { defaultSettings, ClockifySettings } from './settings'
import { ClockifySettingsTab } from './settings-tab'
import { ClockifyService } from './service'
import { displayTracker, loadTracker } from './tracker'

export default class ClockifyPlugin extends Plugin {
	settings: ClockifySettings
	service: ClockifyService

	async onload() {
		await this.loadSettings()

		this.service = new ClockifyService(this, this.settings)

		this.addSettingTab(new ClockifySettingsTab(this.app, this))

		this.registerMarkdownCodeBlockProcessor('clockify-timer', (s, e, i) => {

			console.log('CLOCKIFY: - ' + s)

			const tracker = loadTracker(s)
			e.empty()
			displayTracker(this.service, tracker, e, () => i.getSectionInfo(e), this.settings)
		})

		this.addCommand({
			id: 'insert',
			name: 'Insert Clockify Timer',
			editorCallback: (e) => {
				e.replaceSelection('```clockify-timer\n```\n')
			}
		})
	}

	async loadSettings() {
		this.settings = Object.assign({}, defaultSettings, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}
