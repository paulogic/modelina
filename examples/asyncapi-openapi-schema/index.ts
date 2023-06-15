import { TypeScriptGenerator } from '../../src';
import { PhpGenerator } from '../../src';
import { PhpFileGenerator } from '../../src';

//@@@ const generator = new TypeScriptGenerator();
const options = {
    namespace: 'Scalefast\\Common\\Event',
    declareStrictTypes: true,
    processorOptions: {
        interpreter: {
          ignoreAdditionalProperties: true,
          omitAdditionalProperties: true
        }
    }
  }
const generator: PhpFileGenerator = new PhpFileGenerator(options);
//const generator: PhpGenerator = new PhpGenerator();

//read a JSON file and set contents in variable AsyncAPIDocument
const AsyncAPIDocument = require('../../../oas/generated/json/purchase.json');

export async function generate(): Promise<void> {
  //const models = await generator.generate(AsyncAPIDocument);

  const models = await generator.generateToFiles(AsyncAPIDocument, './files', options);
  //const models = await generator.generateCompleteModels(AsyncAPIDocument, {});
  for (const model of models) {
    console.log(model.result);
  }
}

if (require.main === module) {
  generate();
}
