# 민재네 가족 금지어

엄마, 아빠, 민재가 카카오톡 링크로 함께 보는 가족용 금지어 벌금 현황판입니다.

## 들어있는 기능

- 이달의 금지어 메인 상단 표시
- 금지어 생성/삭제
- 엄마/아빠/민재별 사용 횟수 `+1` / `-1`
- 1회당 200원 벌금 자동 계산
- 벌금 납부 시 해당 구성원의 이번 달 횟수와 미납 벌금 리셋
- 납부 이력 저장
- 월별 선택 및 집계
- 가족은 URL로 조회만 가능
- 관리자 기기만 편집 가능
- Firebase Firestore 실시간 반영
- GitHub Pages에 올릴 수 있는 정적 HTML/CSS/JS 구조
- 모바일 카카오톡 링크에 맞춘 반응형 카드 UI

## 폴더 구조

```text
family-banword-app/
  index.html
  styles.css
  app.js
  firebase-config.js
  firebase-config.example.js
  firestore.rules
  .nojekyll
```

## Firebase 만들기

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트를 만듭니다.
2. 프로젝트에서 웹 앱을 추가합니다.
3. Firebase가 보여주는 `firebaseConfig` 값을 복사합니다.
4. `firebase-config.js`의 `YOUR_...` 값을 실제 값으로 바꿉니다.
5. Firebase Console에서 Firestore Database를 만듭니다.
6. Authentication 메뉴에서 Anonymous 로그인을 활성화합니다.

Firebase 공식 문서는 웹 앱 등록과 SDK 초기화에 Firebase 설정 객체가 필요하다고 안내합니다. 브라우저 모듈 방식은 `https://www.gstatic.com/firebasejs/...` 형태의 import를 사용할 수 있습니다. 참고: [Firebase Web setup](https://firebase.google.com/docs/web/setup)

## 관리자 기기 등록

이 앱은 “특정 컴퓨터에서만 마스터 기능”을 쓰기 위해 Firebase Anonymous Auth 세션을 사용합니다.

1. `firebase-config.js` 설정을 마친 뒤 `index.html`을 엽니다.
2. `관리자 세션 연결` 버튼을 누릅니다.
3. 화면 아래에 표시되는 관리자 UID를 복사합니다.
4. Firebase Console의 Firestore에서 아래 문서를 만듭니다.

```text
apps / minjae-family-banwords / admins / 복사한_UID
```

문서 안에는 예를 들어 아래 필드를 넣으면 됩니다.

```json
{
  "name": "집 컴퓨터",
  "createdAt": "manual"
}
```

5. 같은 브라우저에서 새로고침하면 `관리자 연결됨`으로 바뀌고 편집 버튼이 보입니다.

같은 컴퓨터와 같은 브라우저에서는 로그인 세션이 유지됩니다. 브라우저 데이터를 지우거나 다른 브라우저를 쓰면 새 UID가 만들어질 수 있습니다.

## Firestore 보안 규칙

`firestore.rules` 파일 내용을 Firebase Console의 Firestore Rules에 붙여 넣고 게시합니다.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/apps/minjae-family-banwords/admins/$(request.auth.uid));
    }

    match /apps/minjae-family-banwords/{document=**} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
  }
}
```

이 규칙은 가족 누구나 읽을 수 있지만, 쓰기/수정/삭제는 `admins`에 등록된 관리자 UID만 허용합니다. Firebase 공식 문서는 Security Rules가 클라이언트의 데이터 접근을 승인 또는 차단하며, Firestore 규칙에는 `rules_version = '2';`를 사용할 수 있다고 설명합니다. 참고: [Firebase Security Rules](https://firebase.google.com/docs/rules), [Firestore Security Rules 시작하기](https://firebase.google.com/docs/firestore/security/get-started)

## 첫 데이터 넣기

관리자 권한이 연결된 뒤 앱이 자동으로 기본 금지어 `잠깐만`을 만듭니다. 이후 관리자 화면에서 원하는 금지어를 추가하거나 삭제하면 됩니다.

## GitHub Pages 배포

1. GitHub에서 새 저장소를 만듭니다.
2. 이 폴더 안의 파일을 저장소 최상단에 올립니다.
3. GitHub 저장소의 `Settings` → `Pages`로 이동합니다.
4. `Deploy from a branch`를 선택합니다.
5. 브랜치는 `main`, 폴더는 `/root`로 선택한 뒤 저장합니다.
6. 몇 분 뒤 생성된 GitHub Pages URL을 가족 단체 카톡방에 공유합니다.

## 로컬에서 확인

Firebase 설정을 넣은 뒤 `index.html`을 브라우저로 열어도 동작합니다. 일부 브라우저에서 로컬 모듈 제한이 있으면 간단한 로컬 서버로 열면 됩니다.

```bash
python -m http.server 8080
```

그 다음 `http://localhost:8080`으로 접속합니다.

## 요금 참고

이 앱은 가족 3명이 가볍게 조회하는 용도라 Firestore 무료 사용량 안에서 충분히 쓸 가능성이 큽니다. 다만 Firebase 요금제와 무료 한도는 바뀔 수 있으니 실제 운영 전 [Firebase pricing](https://firebase.google.com/pricing)을 확인하세요.

## 주의할 점

- `firebase-config.js`의 값은 앱 접속에 필요한 공개 설정입니다. 비밀번호처럼 숨기는 값은 아니지만, 쓰기 권한은 반드시 Firestore 보안 규칙으로 막아야 합니다.
- 관리자 UID를 등록하기 전에는 편집이 되지 않는 것이 정상입니다.
- 가족 조회용 URL에는 별도 로그인 없이 현재 상태가 보입니다.
- `APP_ID`를 바꾸면 `firestore.rules` 안의 `minjae-family-banwords` 경로도 같은 값으로 바꿔야 합니다.
