// noinspection JSUnusedGlobalSymbols

import {Resource} from "./resource";

export class LinkParameter {
    name: string = "";
    type: string = "";
    defaultValue: string = "";
    listOfValues: string[] = [];
}

export class Link {
    constructor(link: any, resource: Resource) {
        this.resource = resource;
        this.href = link.href;
        this.verb = link.verb;

        if (link.fields) {
            for (let fieldName in link.fields) {
                let field = link.fields[fieldName] as LinkParameter;
                field.name = fieldName;
                this.parameters.push(field);
            }
        }

        if (link.parameters) {
            for (let parameterName in link.parameters) {
                let parameter = link.parameters[parameterName] as LinkParameter;
                parameter.name = parameterName;
                this.parameters.push(parameter);
            }
        }
    }
    href: string;
    verb: string;
    parameters: LinkParameter[] = [];
    resource: Resource;
}