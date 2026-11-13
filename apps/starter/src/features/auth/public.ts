// 파일 책임: auth feature 밖(route 진입 판정)에서 쓰는 연결만 낸다. 내부 파일 전체를 다시 내지 않는다.
export { isSignedIn } from './storage/signed-in';
