import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return statSync(full).isFile() ? [full] : [];
  });
}

describe('packaged application name', () => {
  test('the Rust crate is named puffsql so the build no longer emits sqlight.exe', () => {
    const cargo = readSource('src-tauri/Cargo.toml');

    assert.match(cargo, /^name = "puffsql"$/m, 'the cargo package name decides the binary name');
    assert.match(cargo, /^name = "puffsql_lib"$/m);
    assert.match(cargo, /authors = \["PuffSQL Team"\]/);
    assert.match(readSource('src-tauri/src/main.rs'), /puffsql_lib::run\(\);/);
  });

  test('the Tauri config ships PuffSQL as both product and main binary name', () => {
    const config = JSON.parse(readSource('src-tauri/tauri.conf.json'));

    assert.equal(config.productName, 'PuffSQL');
    assert.equal(config.mainBinaryName, 'PuffSQL', 'tauri build must rename the binary to PuffSQL.exe');
    assert.equal(config.identifier, 'com.puffsql.app');
    assert.equal(config.app.windows[0].title, 'PuffSQL - Lightweight SQL Client');
  });

  test('the portable build script packages PuffSQL.exe and PuffSQL-Portable.zip', () => {
    const script = readSource('build-portable.ps1');

    assert.match(script, /\$TargetExe = "\$OutDir\\PuffSQL\.exe"/);
    assert.match(script, /\$ZipPath = "\$OutDir\\PuffSQL-Portable\.zip"/);

    const candidates = script.match(/\$CandidateExes = @\(([\s\S]*?)\n\)/)?.[1] ?? '';
    assert.match(candidates, /release\\puffsql\.exe/, 'the cargo output path must follow the crate name');
    assert.doesNotMatch(
      candidates,
      /SQLight|sqlight/i,
      'the picker must not fall back to a stale old-named binary'
    );

    const staleArtifacts = script.match(/\$StaleArtifacts = @\(([\s\S]*?)\n\)/)?.[1] ?? '';
    assert.match(staleArtifacts, /SQLight\.exe/, 'old-named build output must be cleaned away');
    assert.match(staleArtifacts, /SQLight-Portable\.zip/);
    assert.match(readSource('build-portable.bat'), /PuffSQL - Portable Build Launcher/);
  });

  test('runtime log file, data folder and keychain service use the new name', () => {
    assert.match(
      readSource('src-tauri/src/services/query_logger.rs'),
      /LOG_FILE_NAME: &str = "puffsql\.log"/
    );
    assert.match(
      readSource('src-tauri/src/services/storage_service.rs'),
      /const APP_DIR_NAME: &str = "PuffSQL"/
    );
    assert.match(
      readSource('src-tauri/src/services/credential_store.rs'),
      /const SERVICE_NAME: &str = "PuffSQLDesktopClient"/
    );
  });

  test('renames keep the pre-rebrand data reachable instead of orphaning it', () => {
    const storage = readSource('src-tauri/src/services/storage_service.rs');
    const credentials = readSource('src-tauri/src/services/credential_store.rs');

    assert.match(storage, /const LEGACY_APP_DIR_NAME: &str = "SQLight"/);
    assert.match(storage, /fs::rename\(&legacy, &current\)/, 'the old data folder must be migrated');
    assert.match(credentials, /const LEGACY_SERVICE_NAME: &str = "SQLightDesktopClient"/);
    assert.match(credentials, /fn promote_legacy_password/, 'saved passwords must survive the rename');
  });

  test('no old brand name is left in the shipping frontend sources', () => {
    const offenders = walk(resolve(root, 'src'))
      .filter((file) => /\.(ts|vue|css)$/.test(file))
      .filter((file) => readFileSync(file, 'utf-8').includes('SQLight'))
      .map((file) => file.replace(root, ''));

    assert.deepEqual(offenders, [], 'user-visible sources must not carry the old brand name');
  });
});
