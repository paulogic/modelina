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
    const content = [
      //@@ await this.renderProperties(),
      await this.runCtorPreset(),
      //@@ await this.renderAccessors(),
      await this.runAdditionalContentPreset()
    ];

    const ext = this.model.name.endsWith('Event')
        ? ' extends \\Scalefast\\Common\\Event\\AbstractEvent'
        : ' extends \\Scalefast\\Common\\Dto\\AbstractDto';

    const eventname = this.model.name.endsWith('Event')
        ? `public const EVENT_NAME = '${this.model.name}';`
        : '';

    return `final class ${this.model.name}${ext}
{
 ${eventname}

${this.indent(this.renderBlock(content, 2))}
}
`;
  }

  runCtorPreset(): Promise<string> {
    //@@ return this.runPreset('ctor');
    return this.renderCtor();
  }

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
    return this.runPreset('property', { property });
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
      content.push(this.renderBlock([getter]));
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
  property({ property }) {
    //@@
    const propertyRequired = property.required || property.property.type === 'mixed' ? '' : '?';
    /*@@
    const propertyType =
      property.required || property.property.type === 'mixed'
        ? property.property.type
        : `?${property.property.type}`;
    */
    //const util = require('util')
    //console.log('PROP ' + property.propertyName + " " + util.inspect(property.property.originalInput, {showHidden: false, depth: null, colors: true}))
    let propertyType = typeof property.property.originalInput.format !== 'undefined' ?
            (property.property.originalInput.format === 'date-time' ? '\\DateTimeImmutable' : property.property.type) :
            property.property.type;

    return `public readonly ${propertyRequired}${propertyType} $${property.propertyName}`;
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
};
