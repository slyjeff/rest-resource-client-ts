// noinspection JSUnusedGlobalSymbols

import {RestClient} from "./rest-client";
import {Link} from "./link";

export type ResourceType<T extends Resource> = new(_restClient: RestClient) => T;

export class Resource {
    private readonly _links: Map<string, Link> = new Map<string, Link>();
    private readonly _lists: Map<string, object> = new Map<string, object>();
    protected readonly originalValues: Map<string, any> = new Map<string, any>();
    constructor(private readonly _restClient: RestClient) {
    }

    response: Response | undefined;
    get statusCode(): number {
        if (!this.response) {
            return 0;
        }
        return this.response.status
    }

    get isOk(): boolean {
        if (!this.response) {
            return false;
        }
        return this.response.ok;
    }

    private checkForStatusCode(statusCode: number): boolean {
        if (!this.response) {
            return false;
        }
        return this.response.status == statusCode;
    }

    get isBadRequest(): boolean { return this.checkForStatusCode(400); }
    get isUnauthorized(): boolean { return this.checkForStatusCode(401); }
    get isForbidden(): boolean { return this.checkForStatusCode(403); }
    get isNotFound(): boolean { return this.checkForStatusCode(404); }


    private getLink(linkName: string) : Link | undefined {
        return this._links.get(linkName)
    }

    protected async executeLink<T extends Resource>(r: new(...args : any) => T, linkName: string, values: any = {}) : Promise<T> {
        const link = this.getLink(linkName)
        if (link == null) {
            return new r();
        }

        return await this._restClient.executeLink(r, link, values)
    };

    protected hasLink(linkName: string): boolean {
        return this.getLink(linkName) != null;
    }

    protected getResourceList<T extends Resource>(resourceType: ResourceType<T>, propertyName: string): T[] {
        if (this._lists.has(propertyName)) {
            return this._lists.get(propertyName) as T[];
        }

        const list: Array<T> = []

        propertyName = propertyName.toLowerCase();
        if (!this.originalValues.has(propertyName)) {
            this._lists.set(propertyName, list);
            return list;
        }

        for (let source of this.originalValues.get(propertyName)) {
            const resource = new resourceType(this._restClient)
            resource.populateData(source)
            list.push(resource);
        }

        this._lists.set(propertyName, list);

        return list;
    }

    populateData(source : any) : void {
        for (const sourceProperty in source) {
            const value = source[sourceProperty]
            this.originalValues.set(sourceProperty.toLowerCase(), value);

            if (sourceProperty === "_links") {
                for (let linkName in value) {
                    this._links.set(linkName, new Link(value[linkName], this));
                }
                continue;
            }

            for (let destinationProperty in this) {
                if (sourceProperty.toLowerCase() !== destinationProperty.toLowerCase()) {
                    continue;
                }

                if (this[destinationProperty] instanceof Date) {
                    // @ts-ignore
                    this[destinationProperty] = new Date(value);
                    continue;
                }

                this[destinationProperty] = value;
            }
        }
    }
}
