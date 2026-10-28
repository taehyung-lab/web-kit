// 파일 책임: 공연 예시 API 연결(예시 endpoint POST /api/files 업로드 → id, POST /api/shows 등록). 생성 코드가 없는 endpoint를 앱의 apiRequest로 부른다.
import { apiRequest } from '@/app/web-kit';

/** 파일 하나를 올리고 id를 받는다. */
export function uploadFile(file: File): Promise<{ readonly fileId: string }> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<{ fileId: string }>({ url: '/api/files', method: 'POST', data: body });
}

/** 공연 등록. */
export function createShow(request: unknown): Promise<{ readonly showId: string }> {
  return apiRequest<{ showId: string }>({ url: '/api/shows', method: 'POST', data: request });
}
