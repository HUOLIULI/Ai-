import { ensureMlkitFaceDependency, MLKIT_FACE_DEPENDENCY } from '../gradle';

describe('ensureMlkitFaceDependency', () => {
  it('exports the MLKit face dependency coordinate', () => {
    expect(MLKIT_FACE_DEPENDENCY).toContain('com.google.mlkit:face-detection');
  });

  it('injects the dependency into an empty build.gradle', () => {
    const out = ensureMlkitFaceDependency('apply plugin: "com.android.application"\n');
    expect(out).toContain(MLKIT_FACE_DEPENDENCY);
  });

  it('is idempotent when the dependency is already present', () => {
    const withDep = ensureMlkitFaceDependency('dependencies {\n}\n');
    const again = ensureMlkitFaceDependency(withDep);
    const occurrences = again.split(MLKIT_FACE_DEPENDENCY).length - 1;
    expect(occurrences).toBe(1);
  });

  it('adds the dependency inside the existing dependencies block', () => {
    const gradle = 'dependencies {\n    implementation "com.example:foo"\n}\n';
    const out = ensureMlkitFaceDependency(gradle);
    const block = out.slice(out.indexOf('dependencies {'), out.indexOf('}', out.indexOf('dependencies {')));
    expect(block).toContain(MLKIT_FACE_DEPENDENCY);
  });

  it('creates a dependencies block when none exists', () => {
    const out = ensureMlkitFaceDependency('apply plugin: "com.android.application"\n');
    expect(out).toMatch(/dependencies\s*\{/);
  });
});
