(() => {
  "use strict";

  const config = window.REPORT_CONFIG || {};
  const form = document.querySelector("#tester-form");
  const emailInput = document.querySelector("#email");
  const consentInput = document.querySelector("#consent");
  const submitButton = document.querySelector("#submit-button");
  const shareButton = document.querySelector("#kakao-share");
  const status = document.querySelector("#status");

  const setStatus = (message, kind = "") => {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  };

  const bytesToBase64 = (bytes) => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const encryptApplication = async (email) => {
    const jwk = config.emailPublicKeyJwk;
    if (!jwk || !jwk.n || jwk.n.includes("PUBLIC_MODULUS")) {
      throw new Error("암호화 공개키가 아직 설정되지 않았습니다.");
    }

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    const payload = JSON.stringify({
      email: email.trim().toLowerCase(),
      consentAt: new Date().toISOString(),
      purpose: "REPORT_ANDROID_CLOSED_TEST"
    });
    const encrypted = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      key,
      new TextEncoder().encode(payload)
    );
    return bytesToBase64(new Uint8Array(encrypted));
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    if (!emailInput.validity.valid) {
      emailInput.focus();
      setStatus("올바른 Google 계정 이메일을 입력해 주세요.", "error");
      return;
    }
    if (!consentInput.checked) {
      consentInput.focus();
      setStatus("이메일 수집·이용에 동의해 주세요.", "error");
      return;
    }
    if (!config.appsScriptEndpoint) {
      setStatus("신청 접수 주소가 아직 설정되지 않았습니다.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "암호화 중";
    try {
      const ciphertext = await encryptApplication(emailInput.value);
      await fetch(config.appsScriptEndpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          version: 1,
          algorithm: "RSA-OAEP-256",
          ciphertext,
          source: "github-pages"
        })
      });
      form.reset();
      setStatus("신청을 안전하게 전송했습니다. 테스트 초대를 기다려 주세요!", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "신청을 전송하지 못했습니다.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "신청";
    }
  });

  const fallbackShare = async () => {
    const shareData = {
      title: "REP:ORT 비공개 테스트",
      text: "완벽한 운동보다 오늘 한 운동이 낫습니다. REP:ORT를 먼저 만나보세요.",
      url: config.landingUrl || location.href
    };
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(shareData.url);
    setStatus("테스트 신청 링크를 복사했습니다.", "success");
  };

  shareButton.addEventListener("click", async () => {
    try {
      if (window.Kakao && config.kakaoJavaScriptKey) {
        if (!Kakao.isInitialized()) Kakao.init(config.kakaoJavaScriptKey);
        Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: "REP:ORT 비공개 테스트",
            description: "운동을 사진으로 기록하고 함께 꾸준해지는 피트니스 커뮤니티",
            imageUrl: config.imageUrl,
            link: {
              mobileWebUrl: config.landingUrl,
              webUrl: config.landingUrl
            }
          },
          buttons: [
            {
              title: "테스트 신청하기",
              link: { mobileWebUrl: config.landingUrl, webUrl: config.landingUrl }
            },
            {
              title: "앱 둘러보기",
              link: { mobileWebUrl: config.webAppUrl, webUrl: config.webAppUrl }
            }
          ]
        });
        return;
      }
      await fallbackShare();
    } catch (error) {
      if (error && error.name !== "AbortError") {
        setStatus("공유 창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
      }
    }
  });
})();

