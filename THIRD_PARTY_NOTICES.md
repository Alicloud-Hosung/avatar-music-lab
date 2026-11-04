# 이용 조건과 출처

확인 기준일: 2026-11-04.

## 3D 캐릭터

- 모델: HairSample_Male, pixiv VRoid Studio 공개 샘플.
- 파일의 VRM 메타데이터: CC0, Everyone, commercial usage Allow.
- [공식 샘플 이용 조건](https://vroid.pixiv.help/hc/en-us/articles/4402614652569)은 HairSample_Male을 CC0 대상으로 명시합니다.
- [배포본 출처](https://github.com/madjin/vrm-samples/blob/master/vroid/beta/HairSample_Male.vrm).
- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/.
- 런타임에서 의상 색과 재질, 액세서리, 동작과 표정을 변경했습니다. 원본 VRM 파일의 이용 조건과 메타데이터는 유지합니다.
- 자체 제작 캐릭터나 pixiv의 제휴 및 보증을 주장하지 않습니다.

## 렌더링 라이브러리

- Three.js 0.186.1: MIT. `THREE-LICENSE.txt` 참조.
- @pixiv/three-vrm 3.5.5: MIT. `THREE-VRM-LICENSE.txt` 참조.
- `vendor` 안의 Three.js 로더와 유틸리티에도 같은 MIT 라이선스가 적용됩니다.
- 라이브러리는 프로젝트에 고정해 포함했습니다. 외부 글꼴이나 CDN 연결은 사용하지 않습니다.

## 관절 추출

- MediaPipe Pose Landmarker Full, float16/1 및 MediaPipe Tasks Python: Apache-2.0.
- [Google 공식 프로젝트](https://github.com/google-ai-edge/mediapipe).
- [공식 관리자의 해당 Pose 모델 라이선스 확인](https://github.com/google-ai-edge/mediapipe/issues/6306).
- Pose 모델은 이 웹페이지에 포함하지 않으며, 오프라인 추출 도구가 공식 모델 파일을 사용합니다.
- 손가락은 같은 Wan 영상에서 MediaPipe로 측정한 관절 굽힘 값을 사용합니다. 가림 구간에는 이웃 프레임 보간을 사용합니다. 모든 손가락 동작을 완벽하게 복원한 결과는 아닙니다.
- 이 공개 프로젝트는 GVHMR, SMPL 모델이나 그 결과를 포함하지 않습니다.
- MediaPipe는 Alibaba Cloud 자체 모델이 아닙니다. 이 버전의 추출은 로컬 CPU에서 실행했습니다.

## 생성 음원과 영상

- 한국어 남자 보컬 곡과 Wan 안무 영상은 기존에 생성한 같은 곡의 45초 구간입니다. 캐릭터 교체를 위해 음악과 안무를 새로 생성한 것은 아닙니다.
- 배경: Qwen-Image로 생성한 한강 이미지. 3D 테라스 무대의 원거리 배경으로 표시하며 완전한 3D 도시 생성으로 설명하지 않습니다.
- 음악: Alibaba Cloud Model Studio `qwen-audio-3.1-tts-next`.
- 안무 영상: `wan3.0-video`, 15초 구간 3개를 연결.
- 입 모양: `qwen-audio-3.0-asr-flash`로 측정한 단어 시간과 보간한 음절에서 VRM 모음 프리셋을 계산합니다. 원래 아바타의 메시나 표정 데이터는 사용하지 않습니다.
- 생성 서비스의 이용 조건은 해당 서비스 계약에 따릅니다. 생성 미디어를 CC0 또는 위 MIT 코드 라이선스 대상으로 표시하지 않습니다.
- 실존 인물의 녹음이나 얼굴 참조를 입력하지 않았으며, 특정 가수의 목소리 복제를 주장하지 않습니다.

## 공개 범위

- 정적 페이지에서 준비된 음악과 동작을 재생하고 연출을 변경합니다.
- API 키, 고객 자료, 고객사 아바타 및 SDK를 포함하지 않습니다.
- PAI DLC와 OSS를 활용한 운영 확장은 설계로 표시하며 이 공개 버전에 구현했다고 주장하지 않습니다.
