import { moment, requestUrl, RequestUrlParam } from 'obsidian'
import ClockifyPlugin from './main'
import { ClockifySettings } from './settings'
import { Tracker } from './tracker'

export interface ClockifyProject {
	color: string,
	duration: any,
	id: string,
	memberships: any[],
	name: string,
	note: string,
	public: boolean,
	workspaceId: string
}

interface ClockifyClient {
	id: string,
	name: string,
	page: number,
	archived: boolean
}

interface ProjectQueryParams{
	clients: string[]
}

export class ClockifyService {
	app: ClockifyPlugin
	settings: ClockifySettings

	timestampFormat = 'YYYY-MM-DDTHH:mm:ss[Z]'

	constructor(app: ClockifyPlugin, settings: ClockifySettings) {
		this.app = app
		this.settings = settings
	}

	async saveTimer(tracker: Tracker): Promise<string> {

		if(tracker.workspaceId == '' || tracker.projectId == '') {
			const  workspaceId = await this.getObjectId(`${this.settings.baseEndpoint}workspaces`, this.settings.workspace)
			const  projects = await this.listProjects({clients: [tracker.clientId]})
			const projectId = projects[0].id
			console.log('workspaceId', workspaceId)
			console.log('projectId', projectId)
			
			tracker.workspaceId = workspaceId
			tracker.projectId = projectId
		}

		let url = `${this.settings.baseEndpoint}workspaces/${tracker.workspaceId}/time-entries`

		if(tracker.id != '') {
			url = url + '/' + tracker.id
		}

		//console.log("CLOCKIFY: " + url);

		const startTime = moment.unix(tracker.start).format(this.timestampFormat) 

		let json: string

		if(tracker.end == 0) {

			json = JSON.stringify({
				start: startTime,
				description: tracker.description,
				projectId: tracker.projectId
			})
		} else {
			const endTime = moment.unix(tracker.end).format(this.timestampFormat)
			json = JSON.stringify({
				start: startTime,
				end: endTime,
				description: tracker.description,
				projectId: tracker.projectId
			})
		}

		//console.log("CLOCKIFY: Body - " + json);
		const method: string = tracker.id == '' ? 'POST' : 'PUT'
		const options: RequestUrlParam = { url: url, method: method, headers: { 'X-Api-Key': this.settings.apiToken, 'Content-Type': 'application/json' }, body: json }
		//console.log("CLOCKIFY: Options - " + JSON.stringify(options));
        
		try {
			const response = await requestUrl(options)

			return response.json.id
		} catch(e) {
			console.log('CLOCKIFY: + ' + JSON.stringify(e))
		}
	}

	async listProjects(params?: ProjectQueryParams): Promise<ClockifyProject[]>{
		console.log(params)
		const  workspaceId = await this.getObjectId(`${this.settings.baseEndpoint}workspaces`, this.settings.workspace)
		const query = params ? '?' + [params].map(param => param.clients.map(client => `clients=${client}`).join('&')).join('&') : ''
		const url = `${this.settings.baseEndpoint}workspaces/${workspaceId}/projects${query}`
		const options: RequestUrlParam = { url: url, method: 'GET', headers: { 'X-Api-Key': this.settings.apiToken, 'Content-Type': 'application/json' } }
		
		try {
			const response = await requestUrl(options)
			
			return response.json
		} catch(e) {
			console.error('CLOCKIFY: + ' + JSON.stringify(e))
		}
	}

	async listClients(params?: {name: string}): Promise<ClockifyClient[]>{
		const  workspaceId = await this.getObjectId(`${this.settings.baseEndpoint}workspaces`, this.settings.workspace)
		const query = params ? `?name=${params.name}` : ''
		const url = `${this.settings.baseEndpoint}workspaces/${workspaceId}/clients${query}`
		const options: RequestUrlParam = { url: url, method: 'GET', headers: { 'X-Api-Key': this.settings.apiToken, 'Content-Type': 'application/json' } }
		
		try {
			const response = await requestUrl(options)
			return response.json
		} catch(e) {
			console.error('CLOCKIFY: + ' + JSON.stringify(e))
		}
	}

	async getObjectId(url: string, objectName: string) : Promise<string> {
		const options: RequestUrlParam = { url: url, method: 'GET', headers: {'X-Api-Key': this.settings.apiToken}}
		//console.log("CLOCKIFY: GetObjectId - " + url);
		try {
			const response = await requestUrl(options)
			for(let i = 0; i < response.json.length; i++) {
				console.log('CLOCKIFY: Name - ' + response.json[i].name)
				if(response.json[i].name == objectName) {
					return response.json[i].id
				}
			}
		} catch(e) {
			console.log('CLOCKIFY: + ' + JSON.stringify(e))
		}
		return ''
	}
}
