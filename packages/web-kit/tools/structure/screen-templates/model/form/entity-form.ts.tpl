// 파일 책임: {{Entity}} 폼의 값 모양·검증(순수). web-kit-new가 만든 골격이다.
import { z } from 'zod';

// TODO(web-kit-new): 서버 명세의 필드·제약을 옮긴다(필수 표시도 이 schema가 정한다). 채우기 전에는 typecheck가 실패한다.
export const {{entityCamel}}FormSchema = z.object({{TODO}}form_fields);
export type {{Entity}}FormInput = z.input<typeof {{entityCamel}}FormSchema>;
export type {{Entity}}FormOutput = z.output<typeof {{entityCamel}}FormSchema>;
