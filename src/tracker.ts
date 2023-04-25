
import { moment, App, MarkdownSectionInformation, ButtonComponent, TextComponent } from 'obsidian'
import { ClockifySettings } from './settings'
import { ClockifyProject, ClockifyService } from './service'

export enum State {
    Uninitialised,
    Running,
    Completed
}

export interface Tracker {
    state: State,
    workspaceId: string,
    projectId: string,
    id: string,
    description: string,
    start: number,
    end: number,
	clientId?: string
}

export async function saveTracker(service: ClockifyService, tracker: Tracker, app: App, section: MarkdownSectionInformation): Promise<void> {
	const file = app.workspace.getActiveFile()

	if(!file) {
		return
	}

	const id = await service.saveTimer(tracker)

	if(tracker.id == '') {
		console.log('CLOCKIFY: Set Id ' + id)
		tracker.id = id
	}

	let content = await app.vault.read(file)

	// figure out what part of the content we have to edit
	const lines = content.split('\n')
	const prev = lines.filter((_, i) => i <= section.lineStart).join('\n')
	const next = lines.filter((_, i) => i >= section.lineEnd).join('\n')
	// edit only the code block content, leave the rest untouched
	content = `${prev}\n${JSON.stringify(tracker)}\n${next}`

	await app.vault.modify(file, content)
}

export function loadTracker(json: string): Tracker {
	if (json) {     
		try {
			return JSON.parse(json)
		} catch (e) {
			console.log(`Failed to parse Tracker from ${json}`)
		}
	}
	return { state: State.Uninitialised, id: '', description: '', start: 0, end: 0, projectId: '', workspaceId: '' }
}

export async function displayTracker(service: ClockifyService, tracker: Tracker, element: HTMLElement, getSectionInfo: () => MarkdownSectionInformation, settings: ClockifySettings): Promise<void> {

	const uiDetails = getUiDetails(tracker)

	// Add in the workspace and project details. Useful hint in case it needs changing.
	const projectDetailsDiv = element.createDiv({cls: 'clockify-tracker-heading'})
	projectDetailsDiv.createEl('span', { text: `${settings.workspace}/${settings.project}`})

	const table = element.createEl('table', {cls: 'clockify-tracker-table'})
    
	// First Column
	const descriptionCell = table.createEl('td')
	descriptionCell.addClass('clockify-tracker-cell')
	const descriptionNameBox = new TextComponent(descriptionCell)
		.setPlaceholder('Description')
		.setDisabled(tracker.state == State.Running)
		.onChange(() => {
			tracker.description = descriptionNameBox.getValue()
		})
	descriptionNameBox.inputEl.addClass('clockify-tracker-txt')
	descriptionNameBox.setValue(tracker.description)

	// Second Column
	const selectClientCell = table.createEl('td')
	selectClientCell.addClass('clockify-clients')
	const clients = await service.listClients()
	const clientSelect = element.createEl('select')
	// Set the first client as the default client
	if(!tracker.clientId){
		tracker.clientId = clients[0].id
	}
	
	clients.forEach(client => {
		const option = element.createEl('option')
		option.text = client.name
		option.value = client.id 
		option.defaultSelected = client.id == tracker.clientId
		clientSelect.add(option)
	})
	selectClientCell.appendChild(clientSelect)

	// Third Column but depending on th
	const selectProjectsCell = table.createEl('td')
	selectProjectsCell.addClass('clockify-projects')
	const projectSelect = element.createEl('select')
	const projects = await service.listProjects({clients: [tracker.clientId]})
	listSelectProject(projects, element, tracker, projectSelect)
	selectProjectsCell.appendChild(projectSelect)

	clientSelect.addEventListener('change', async (event) => {
		// This is super confusing: https://stackoverflow.com/questions/44321326/property-value-does-not-exist-on-type-eventtarget-in-typescript
		tracker.clientId = (event.target as HTMLOptionElement).value
		
		// Update the project list
		const updateSelect = element.createEl('select')
		const projects = await service.listProjects({clients: [tracker.clientId]})
		listSelectProject(projects, element, tracker, updateSelect)
		selectProjectsCell.removeChild(projectSelect)
		selectProjectsCell.appendChild(updateSelect)
	})
		
	// Fourth Column
	const buttonCell = table.createEl('td')
	buttonCell.addClass('clockify-tracker-cell')
	const durationCell = table.createEl('td')
	setCountDown(tracker, durationCell)

	const btn = new ButtonComponent(buttonCell)
		.setClass('clickable-icon')
		.setIcon(`lucide-${uiDetails.icon}`)
		.setTooltip(uiDetails.toolTip)
		.onClick(async () => {
			switch(tracker.state) {
			case State.Running:
				end(tracker)
				break

			case State.Uninitialised:
				start(tracker)
				descriptionNameBox.setDisabled(true)
				break
			}
			await saveTracker(service, tracker, this.app, getSectionInfo())
		})

	btn.buttonEl.addClass('clockify-tracker-btn')

	table.createEl('tr').append(
		descriptionCell,
		selectClientCell,
		selectProjectsCell,
		durationCell,
		buttonCell
	)

	const intervalId = window.setInterval(() => {
		// Interval timer must be removed when window is closed.
		if (!element.isConnected) {
			window.clearInterval(intervalId)
			return
		}
		setCountDown(tracker, durationCell)
	}, 1000)
}

function listSelectProject(projects: ClockifyProject[], element: HTMLElement, tracker: Tracker, projectSelect: HTMLSelectElement) {
	projects.forEach(proj => {
		const option = element.createEl('option')
		option.text = proj.name
		option.value = proj.id
		option.defaultSelected = proj.id == tracker.clientId
		projectSelect.add(option)
	})

	projectSelect.addEventListener('change', (event) => {
		// This is super confusing: https://stackoverflow.com/questions/44321326/property-value-does-not-exist-on-type-eventtarget-in-typescript
		tracker.projectId = (event.target as HTMLOptionElement).value
	})
}

function setCountDown(tracker: Tracker, current: HTMLElement) {
	const duration = getDuration(tracker)
	const durationText = formatDuration(duration)
	current.setText(durationText)
}

function getDuration(tracker: Tracker) {

	switch(tracker.state) {
	case State.Running:
		return moment().diff(moment.unix(tracker.start))
	case State.Completed:
		return moment.unix(tracker.end).diff(moment.unix(tracker.start))
	default:
		return 0
	}
}    

function start(tracker: Tracker): void {
    
	if(tracker.state != State.Uninitialised) {
		return
	}

	tracker.state = State.Running
	tracker.start = moment().unix()
}

function end(tracker: Tracker): void {

	if(tracker.state != State.Running) {
		return
	}
    
	tracker.state = State.Completed
	tracker.end = moment().unix()
}

function getUiDetails(tracker: Tracker) {
    
	switch(tracker.state) {
	case State.Running: {
		return { icon: 'stop-circle', toolTip: 'End' }
	}

	case State.Completed: {
		return { icon: 'edit', toolTip: 'Update Description' }
	}

	case State.Uninitialised: {
		return { icon: 'play-circle', toolTip: 'Start' }
	}

	default: {
		return { icon: 'x', toolTip: 'Error' }
	}
	}
}

function formatDuration(totalTime: number): string {
	const duration = moment.duration(totalTime)

	let ret = ''
	if (duration.years() > 0) {
		ret += duration.years() + 'y '
	}
	if (duration.months() > 0) {
		ret += duration.months() + 'm '
	}
	if (duration.days() > 0) {
		ret += duration.days() + 'd '
	}
	if (duration.hours() > 0) {
		ret += duration.hours() + 'h '
	}
	if (duration.minutes() > 0) {
		ret += duration.minutes() + 'm '
	}
	ret += duration.seconds() + 's'
	return ret
}
