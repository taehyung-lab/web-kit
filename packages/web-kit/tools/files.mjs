// 파일 책임: 소비 도구가 프로젝트 안의 실제 파일만 읽고 내용 지문을 계산하게 한다.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** 파일 내용 또는 문자열의 SHA-256 지문을 계산한다. */
export function digest(content) { return createHash('sha256').update(content).digest('hex'); }
/** JSON 파일을 읽는다. */
export function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
/** 상대 경로가 루트 밖이나 외부 심링크로 이어지면 읽기·쓰기 전에 거절한다. */
export function projectPath(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw new Error('프로젝트 상대 경로가 필요합니다: ' + path);
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('프로젝트 밖 경로: ' + path);
  // 최종 파일이 아직 없어도 기존 부모의 실제 위치를 확인한다.
  let current = root;
  for (const part of rel.split(sep)) {
    current = resolve(current, part);
    if (existsSync(current) || (() => { try { return lstatSync(current).isSymbolicLink(); } catch { return false; } })()) {
      const actual = relative(realpathSync(root), realpathSync(current));
      if (actual === '..' || actual.startsWith('..' + sep) || isAbsolute(actual)) throw new Error('프로젝트 밖 심링크: ' + path);
    }
  }
  return target;
}
