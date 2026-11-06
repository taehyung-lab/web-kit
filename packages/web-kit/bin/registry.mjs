#!/usr/bin/env node
// 파일 책임: 소비 프로젝트가 공통 설치 기록·변경 비교를 실행하게 한다.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareInstallation, recordInstallation } from '../tools/registry.mjs';
import { projectPath, readJson } from '../tools/files.mjs';

/** 값이 필요한 옵션을 읽고 빠진 값은 거절한다. */
function option(name, fallback) {
  const at = process.argv.indexOf(name);
  if (at < 0) { if (fallback !== undefined) return fallback; throw new Error('필수 인자: ' + name); }
  const value = process.argv[at + 1];
  if (!value || value.startsWith('--')) throw new Error('값이 필요합니다: ' + name);
  return value;
}
try {
  const mode = process.argv[2];
  if (process.argv.includes('--help')) {
    console.log('사용법: web-kit-registry record --source <키트 checkout> --items form,auth [--project .] [--paths paths.json] [--output registry-installation.json]\n비교: web-kit-registry compare --source <새 checkout> [--project .] [--installation registry-installation.json]\nrecord는 새 기록만 만들며 기존 기록 갱신에는 --update가 필요합니다. --update에서 --items를 빼면 기존 기록의 항목을 그대로 씁니다. UI 파일과 lockfile은 바꾸지 않습니다.');
  } else {
    const project = resolve(option('--project', '.'));
    const source = resolve(option('--source'));
    const kit = readJson(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'));
    if (mode === 'record') {
      const output = projectPath(project, option('--output', 'registry-installation.json'));
      if (dirname(output) !== project) throw new Error('설치 기록은 프로젝트 루트에 두세요. --output에는 파일 이름만 지정하세요');
      if (existsSync(output) && !process.argv.includes('--update')) throw new Error('설치 기록이 이미 있습니다. 변경 비교·검토 뒤 --update를 사용하세요');
      // 갱신에서 --items를 빼면 기존 기록의 항목을 그대로 다시 기록한다. 새 기록은 항목을 반드시 받는다.
      const items = !process.argv.includes('--items') && process.argv.includes('--update') && existsSync(output)
        ? readJson(output).items.map((item) => item.name)
        : option('--items').split(',');
      const record = recordInstallation({ source, project, version: kit.version, selected: items, paths: process.argv.includes('--paths') ? readJson(resolve(option('--paths'))) : {} });
      writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
      console.log('설치 기록: ' + output + ' (' + record.items.map((item) => item.name).join(', ') + ')');
    } else if (mode === 'compare') {
      console.log(JSON.stringify(compareInstallation({ installation: readJson(resolve(project, option('--installation', 'registry-installation.json'))), source, project, version: readJson(resolve(source, 'packages/web-kit/package.json')).version }), null, 2));
    } else throw new Error('record 또는 compare를 선택하세요. --help로 사용법을 확인하세요');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
