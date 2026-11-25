import { readFileSync } from 'fs';
import { join } from 'path';
import { GUIDANCE_SCHEMA } from '../../constants/guidanceProtocol';

// The JSON Schema contract is hand-maintained in two places: the runtime
// validator/prompt source (GUIDANCE_SCHEMA) and the published docs file. A
// drift between them silently breaks either the model's structured output or
// the documented contract. This test fails the build when they diverge.
const docsSchema = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/camera-guidance-v3.schema.json'), 'utf8'),
);

describe('guidance v3 schema consistency', () => {
  it('docs JSON schema matches the runtime GUIDANCE_SCHEMA exactly', () => {
    expect(docsSchema).toEqual(GUIDANCE_SCHEMA);
  });

  it('shares the same top-level required field set', () => {
    expect([...docsSchema.required].sort()).toEqual([...GUIDANCE_SCHEMA.required].sort());
  });

  it('exposes the same property keys', () => {
    expect(Object.keys(docsSchema.properties).sort())
      .toEqual(Object.keys(GUIDANCE_SCHEMA.properties).sort());
  });
});
