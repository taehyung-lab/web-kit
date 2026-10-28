// 파일 책임: 설치된 web-kit이 주는 사용 스킬이 .agents/skills에 빠짐없이 연결돼 있고, 끊긴·남은 링크가 없는지 본다.
/// <reference types="node" />
import { existsSync, lstatSync, readdirSync, readlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

// vitest는 저장소 루트에서 실행된다(jsdom 환경이라 import.meta.url은 파일 경로가 아니다).
const root = process.cwd();
const skillsDir = join(root, '.agents/skills');
const kitSkills = join(root, 'node_modules/@boosterlab/web-kit/skills');

it('links every skill the installed web-kit ships, and nothing else under web-kit-*', () => {
  const shipped = readdirSync(kitSkills).filter((name) => existsSync(join(kitSkills, name, 'SKILL.md'))).sort();
  const linked = readdirSync(skillsDir).filter((name) => name.startsWith('web-kit-')).sort();
  expect(linked).toEqual(shipped);
  for (const name of linked) {
    const path = join(skillsDir, name);
    expect(lstatSync(path).isSymbolicLink(), `${name} is a link`).toBe(true);
    expect(resolve(skillsDir, readlinkSync(path)), `${name} points at the installed package`).toBe(join(kitSkills, name));
  }
});

it('has no broken skill links', () => {
  for (const name of readdirSync(skillsDir)) {
    const path = join(skillsDir, name);
    if (lstatSync(path).isSymbolicLink()) expect(existsSync(join(path, 'SKILL.md')), `${name} resolves`).toBe(true);
  }
});
