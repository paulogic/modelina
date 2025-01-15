import { PhpRenderer } from '../PhpRenderer';
import {
  ConstrainedObjectModel,
  ConstrainedObjectPropertyModel
} from '../../../models';
import { FormatHelpers } from '../../../helpers';
import { PhpOptions } from '../PhpGenerator';
import { ClassPresetType } from '../PhpPreset';

/**
 * Renderer for PHP's `class` type
 *
 * @extends PhpRenderer
 */
export class ClassRenderer extends PhpRenderer<ConstrainedObjectModel> {
  async defaultSelf(): Promise<string> {

      /*
      const content = [
          //await this.renderProperties(),
          await this.runCtorPreset(),
          //await this.renderAccessors(),
          await this.runAdditionalContentPreset()
      ];
      */

    //const util = require('util')
    //console.log('LOG ' + util.inspect(this.model, {showHidden: false, depth: null, colors: true}))

    const plainName = this.model.name.substring(this.model.name.lastIndexOf('/')+1);
    let classType = 'class';
    let ext = '';
    let block = '';
    let eventName = '';
    let ctor = '';
    let content = [];

    switch (true) {
       case plainName.endsWith('Event'):
           ctor = await this.runCtorPreset();
           ext = this.options.eventsParentClass !== undefined ? ' extends \\' + this.options.eventsParentClass : ''
           content = [ctor, await this.runAdditionalContentPreset()];
           block = this.indent(this.renderBlock(content, 2));
           eventName = `public const EVENT_NAME = '${plainName}';`
           break;
       case plainName.endsWith('Interface'):
          classType = 'interface';
          block = await this.renderAdditional();
          break;
       default:
          //Considered a normal Dto
          ctor = await this.runCtorPreset();
          ext =  this.options.dtoParentClass !== undefined ? ' extends \\' + this.options.dtoParentClass : ''
          content = [ctor, await this.runAdditionalContentPreset()];
          block = this.indent(this.renderBlock(content, 2));
          break;
    }
    const interfaces = await this.getInterfaces(this.model.originalInput);
    const int = interfaces.length ? " implements \n" + interfaces.join(',\n ') : '';
    const methods = await this.renderMethods();

    return `
/**
 * DO NOT MODIFY - THIS CLASS WAS AUTOMATICALLY CREATED
 *
${methods}
 */
${classType} ${plainName}${ext}
${int}
{
 ${eventName}

${block}
}
`;
  }

  //
  async renderMethods(): Promise<string> {
    const properties = this.model.properties || {};
    const content: string[] = [];
    for (const property of Object.values(properties)) {
      const types = await this.getTypeDefinitionString(property);
      content.push(' * @method ' + types + ' get' + FormatHelpers.toPascalCase(property.propertyName) + '()');
    }
    return this.renderBlock(content);
  }

  async runCtorPreset(): Promise<string> {
    // return this.runPreset('ctor');
    return this.renderCtor();
  }


  async runAdditionalContentPreset(): Promise<string> {
    // return this.runPreset('additionalContent');
    return this.renderAdditional();
  }


  //
  async renderAdditional(): Promise<string> {
    const add = await this.getAdditionalContent(this.model.originalInput);
    return this.renderBlock(add);
  }

  //
  async renderCtor(): Promise<string> {
    const properties = this.model.properties || {};
    const content: string[] = [];

    content.push(`public function __construct(`);
    for (const property of Object.values(properties)) {
      const rendererProperty = await this.runPropertyPreset(property);
      content.push(rendererProperty + ', ');
    }

    if (this.model.name.endsWith('Event')) {
        content.push(`) { parent::__construct(); }`);
    } else {
        content.push(`) { }`);
    }
     return this.renderBlock(content);
  }

  //
  async getInterfaces(obj: any): Promise<Array<string>> {
    return this.getNestedProperty('x-parser-interfaces', obj, []);
  }

  //
  async getAdditionalContent(obj: any): Promise<Array<string>> {
    return this.getNestedProperty('x-parser-additional-content', obj, []);
  }

  //
  getNestedProperty(property: string, obj: any, list: Array<string>): Array<string> {

    if (typeof obj[property] !== 'undefined') {
        list = list.concat(obj[property]);
    }
    if (typeof obj.allOf !== 'undefined') {
        for (const elem of obj.allOf) {
            list = list.concat(this.getNestedProperty(property, elem, list));
        }
    }
    if (typeof obj.originalInput !== 'undefined') {
        list = list.concat(this.getNestedProperty(property, obj.originalInput, list));
    }
    return list.filter(function(elem, index, self) {
               return index === self.indexOf(elem);
           });
  }

  //
  getTypes(obj: any, list: Array<string>): Array<string> {

    const type = obj.type;

    if (typeof type !== 'undefined') {
        let types_set = new Set([type])
        if (obj.options && obj.options.isNullable) {
          types_set.add('null');
        }
        const types = Array.from(types_set)
        for (const t of types) {
            switch (t) {
               case 'mixed':
                   list = list.concat(this.getTypes(obj.originalInput, list));
                   break;
               case 'object':
                   let u = typeof obj['x-parser-schema-id'] === 'string' ? obj['x-parser-schema-id'] : t;
                   list.push(u);
                   break;
               default:
                   list.push(t);
            }
        }
    } else {
      if (typeof obj.oneOf !== 'undefined') {
         for (const elem of obj.oneOf) {
            list = list.concat(this.getTypes(elem, list));
         }
      }
    }
     return list.filter(function(elem, index, self) {
          return index === self.indexOf(elem);
     });
  }

  //
  getTypeDefinitionString(property: any): string {
        let types = this.getTypes(property.property, []);
        //*Particular*: if types contains 'GenericObject', remove 'array' from types
        if (types.includes('Ignore/GenericObject')) {
            types = types.filter((t:string) => t !== 'array');
        }
        let propertyType = types.join('|').
            replace(/boolean/g, 'bool').replace(/integer/g, 'int').replace(/number/g, 'float');
        if (typeof property.property.originalInput.format !== 'undefined') {
            propertyType = property.property.originalInput.format === 'date-time' ? '\\DateTimeInterface' : propertyType;
        }
        return propertyType.substring(propertyType.lastIndexOf('/')+1);
  }

  //
  getDefaultPropertyValue(property: any, type: any): string {
      let propertyDefault = '';
      if (typeof property.originalInput.default !== 'undefined') {
          if (property.originalInput.default === null) {
              propertyDefault = '= null';
          } else {
              switch (type) {
                  case 'string':
                      propertyDefault = `= '${property.originalInput.default}'`;
                      break;
                  case 'int':
                  case 'integer':
                  case 'float':
                  case 'number':
                      propertyDefault = `= ${property.originalInput.default}`;
                      break;
                  case 'array':
                      propertyDefault = `= ${JSON.stringify(property.originalInput.default)}`;
                      break;
                  case 'bool':
                  case 'boolean':
                      propertyDefault = `= ${property.originalInput.default ? 'true' : 'false'}`;
                      break;
                  default:
                      propertyDefault = `= '${property.originalInput.default}'`;
              }
          }
      }
      return propertyDefault;
  }


  /**
   * Render all the properties for the class.
   */
  async renderProperties(): Promise<string> {
    const properties = this.model.properties || {};
    const content: string[] = [];

    for (const property of Object.values(properties)) {
      const rendererProperty = await this.runPropertyPreset(property);
      content.push(rendererProperty + ';');
    }

    return this.renderBlock(content);
  }

  runPropertyPreset(property: ConstrainedObjectPropertyModel): Promise<string> {
    return this.runPreset('property', { property, this: this });
  }

  /**
   * Render all the accessors for the properties
   */
  async renderAccessors(): Promise<string> {
    const properties = this.model.properties || {};
    const content: string[] = [];

    for (const property of Object.values(properties)) {
      const getter = await this.runGetterPreset(property);
      const setter = await this.runSetterPreset(property);
      content.push(this.renderBlock([getter, setter]));
    }

    return this.renderBlock(content, 2);
  }

  runGetterPreset(property: ConstrainedObjectPropertyModel): Promise<string> {
    return this.runPreset('getter', { property });
  }

  runSetterPreset(property: ConstrainedObjectPropertyModel): Promise<string> {
    return this.runPreset('setter', { property });
  }

}

export const PHP_DEFAULT_CLASS_PRESET: ClassPresetType<PhpOptions> = {
  self({ renderer }) {
    return renderer.defaultSelf();
  },
  property({ property, renderer }) {
    let types = renderer.getTypes(property.property, []);
    if (types.length === 0) {
        return `public readonly array $params`;
    }
    let nullable = false;
    if (types.includes('null')) {
        nullable = true;
        types = types.filter((t: string) => t !== 'null');
    }
    const propertyNullable = nullable ? '?' : '';
    if (types.length > 1) {
        types = types.filter((t: string) => t !== 'array');
    }
    let propertyType = types.join('|').
        replace(/boolean/g, 'bool').replace(/integer/g, 'int').replace(/number/g, 'float');

    if (typeof property.property.originalInput.format !== 'undefined') {
        propertyType = property.property.originalInput.format === 'date-time' ? '\\DateTimeInterface' : propertyType;
    }
    const propertyDefault = renderer.getDefaultPropertyValue(property.property, propertyType);
    const readonly = property.property.originalInput['x-parser-readonly'] === false ? '' : 'readonly';
    const plainPropertyType = propertyType.substring(propertyType.lastIndexOf('/')+1);
    return `public ${readonly} ${propertyNullable}${plainPropertyType} $${property.propertyName} ${propertyDefault}`;
  },
  getter({ property }) {
    const getterName = FormatHelpers.toPascalCase(property.propertyName);
    const propertyType =
      property.required || property.property.type === 'mixed'
        ? property.property.type
        : `?${property.property.type}`;

    return `public function get${getterName}(): ${propertyType} { return $this->${property.propertyName}; }`;
  },
  setter({ property }) {
    const setterName = FormatHelpers.toPascalCase(property.propertyName);
    const propertyType =
      property.required || property.property.type === 'mixed'
        ? property.property.type
        : `?${property.property.type}`;

    return `public function set${setterName}(${propertyType} $${property.propertyName}): void { $this->${property.propertyName} = $${property.propertyName}; }`;
  },
  //additionalContent({ model }) {
  //  return model.originalInput['x-parser-additional-content'] || '';
  //}
};
