// noinspection JSUnusedGlobalSymbols

import {Resource, ResourceType} from "./resource";
import {Link} from "./link";

export class RestClientError extends Error {
    constructor(response: Response) {
        super(response.statusText);
        this.statusCode = response.status;
        this.response = response;
    }
    statusCode: number
    response: Response
}

export class RestClient {
    private readonly _baseUrl: string;
    private _setCookie: string | undefined;

    constructor(_baseUrl: string) {
        this._baseUrl = _baseUrl;
    }

    //normally this should not be used: the browser handles it, but it needs to be done manually when being used outside a browser (ie: PlayWright)
    handleCookies: boolean = false;
    //be default, non success status codes will throw an error. If this is set to false, an empty class can be returned instead which will contain the response
    throwExceptions: boolean = true;

    async get<T extends Resource> (resourceType: ResourceType<T>, path: string = ""): Promise<T> {
        return await this.execute(resourceType, 'GET', path )
    }

    async executeLink<T extends Resource> (resourceType: ResourceType<T>, link: Link, values: Record<string,any> = {}): Promise<T> {
        const verb = link.verb ? link.verb : "GET";
        const params: Record<string,any> = {} = {};
        let setParameterFromSource = function (parameter: string, source: any): boolean {
            for (let value in source) {
                if (parameter.toLowerCase() !== value.toLowerCase()) {
                    continue;
                }

                params[parameter] = source[value];
                return true;
            }
            return false;
        }

        //loop through the expected parameters and populate them, first looking in passed in values, second looking in the resource, finally looking at the default value
        for (const parameter of link.parameters) {
            if (setParameterFromSource(parameter.name, values)) {
                continue;
            }

            if (setParameterFromSource(parameter.name, link.resource)) {
                continue;
            }

            if (parameter.defaultValue) {
                params[parameter.name] = values[parameter.defaultValue];
            }
        }

        return await this.execute(resourceType, verb, link.href, params);
    }

    async execute<T extends Resource> (resourceType: ResourceType<T>, verb: string, path: string, params: Record<string, any> = {}): Promise<T> {
        params = this.convertDatesToStrings(params);

        const url = new URL(this._baseUrl);
        if (path != "") {
            if (path.includes("?")) {
                const parts = path.split("?")
                url.pathname = parts[0]
                url.search = parts[1]
            } else {
                url.pathname = path;
            }
        }

        const contentType =  verb == "PATCH"
            ? "application/merge-patch+json"
            : "application/json";

        if (Object.keys(params).length > 0 && (verb == "GET" || verb == "DELETE")) {
            for (const param in params ) {
                url.searchParams.set(param, params[param]);
            }
        }

        const hasBody = (Object.keys(params).length > 0 && (verb == "POST" || verb == "PUT" || verb == "PATCH"));

        let headers: Record<string,string> = {
            'Content-Type': contentType,
            'Accept': 'application/slysoft+json, application/json'
        }

        if (this._setCookie) {
            headers['Cookie'] = this._setCookie;
        }

        let response: Response
        if (hasBody) {
            response = await fetch(url.toString(), {
                credentials: 'include',
                method: verb,
                headers: headers,
                body: JSON.stringify(params)
            })
        } else {
            response = await fetch(url.toString(), {
                credentials: 'include',
                method: verb,
                headers: headers
            })
        }

        const responseToReturn = response.clone();
        if (!response.ok) {
            if (this.throwExceptions) {
                throw new RestClientError(responseToReturn);
            } else {
                const resource = new resourceType(this);
                resource.response = responseToReturn;
                return resource;
            }
        }

        if (this.handleCookies) {
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) {
                this._setCookie = setCookie;
            }
        }

        let json: any = {};
        if (this.responseIsJson(response)) {
            try {
                json = await response.json();
            } catch {
                //eat the exception and just use an empty object- it should be json, but there was an issue parsing it
            }
        }

        const resource = new resourceType(this);
        resource.populateData(json)
        resource.response = responseToReturn;

        return resource;
    }

    convertDatesToStrings(params: Record<string, any> = {}): Record<string, any> {
        const result: Record<string, any> = {};

        for (const key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                const value = params[key];

                if (value instanceof Date) {
                    result[key] = value.toISOString(); // Convert Date to ISO string
                } else {
                    result[key] = value; // Keep other values as they are
                }
            }
        }

        return result;
    }

    private responseIsJson(response: Response): boolean {
        const receivedContentType =response.headers.get('content-type');
        if (!receivedContentType) {
            return false;
        }
        return (receivedContentType.includes('application/json') || receivedContentType.includes('application/slysoft+json'));
    }
}