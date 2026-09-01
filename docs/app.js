(() => {
  "use strict";

  const config = window.REPORT_CONFIG || {};
  const form = document.querySelector("#tester-form");
  const emailInput = document.querySelector("#email");
  const inviteCodeInput = document.querySelector("#invite-code");
  const submitButton = document.querySelector("#submit-button");
  const shareButton = document.querySelector("#kakaotalk-sharing-btn");
  const openSharedRecord = document.querySelector("#open-shared-record");
  const sharedRecordPreview = document.querySelector("#shared-record-preview");
  const sharedRecordCard = document.querySelector("#shared-record-card");
  const sharedRecordStatus = document.querySelector("#shared-record-status");
  const sharedRecordAvatar = document.querySelector("#shared-record-avatar");
  const sharedRecordNickname = document.querySelector("#shared-record-nickname");
  const sharedRecordMeta = document.querySelector("#shared-record-meta");
  const sharedRecordPhoto = document.querySelector("#shared-record-photo");
  const sharedRecordNote = document.querySelector("#shared-record-note");
  const sharedRecordLikeCount = document.querySelector("#shared-record-like-count");
  const sharedRecordCommentCount = document.querySelector("#shared-record-comment-count");
  const sharedRecordHeart = document.querySelector("#shared-record-heart");
  const sharedRecordAppButton = document.querySelector("#shared-record-app-button");
  const sharedRecordInvite = document.querySelector("#shared-record-invite");
  const sharedRecordInviteButton = document.querySelector("#shared-record-invite-button");
  const status = document.querySelector("#status");
  const inviteCompleteCard = document.querySelector("#invite-complete-card");
  const inviteCompleteMark = document.querySelector("#invite-complete-mark");
  const inviteCompleteTitle = document.querySelector("#invite-complete-title");
  const inviteCompleteDetail = document.querySelector("#invite-complete-detail");
  const playStoreCard = document.querySelector("#play-store-card");
  const APPLICATION_RECEIVED_AT_KEY = "report.testerApplication.receivedAt.v1";
  const SHARED_RECORD_CACHE_PREFIX = "report.sharedRecord.v1.";

  const pageParams = new URLSearchParams(location.search);
  const pageMode = pageParams.get("mode");
  const sharedPostId = pageParams.get("post");
  const isSharedRecord = pageMode === "record" && /^\d+$/.test(sharedPostId || "");
  const requestedDocumentId = /^\d+$/.test(pageParams.get("doc") || "")
    ? pageParams.get("doc")
    : sharedPostId;
  const userAgent = navigator.userAgent || "";
  const isiOS = /iPad|iPhone|iPod/i.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(userAgent)
    && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR|Android)/i.test(userAgent);
  const androidUnsupported = isiOS || isSafari;
  const sharedRecordDeepLink = isSharedRecord
    ? `report://record?post=${encodeURIComponent(sharedPostId)}`
    : "";
  if (openSharedRecord && isSharedRecord) {
    openSharedRecord.href = sharedRecordDeepLink;
    openSharedRecord.hidden = false;
  }

  const invitationUrl = () => {
    const target = new URL(config.landingUrl || location.origin + location.pathname, location.href);
    target.search = "";
    target.hash = "";
    target.searchParams.set("mode", "invite");
    return target.href;
  };

  const decodeFirestoreValue = (value) => {
    if (!value || typeof value !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return Boolean(value.booleanValue);
    if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
    if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
    if (value.arrayValue) return (value.arrayValue.values || []).map(decodeFirestoreValue);
    if (value.mapValue) return decodeFirestoreFields(value.mapValue.fields || {});
    return null;
  };

  const decodeFirestoreFields = (fields) => Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );

  const normalizeFirestorePost = (post) => {
    if (!post || typeof post !== "object") return null;
    const id = Number(post.id);
    if (!Number.isSafeInteger(id) || String(id) !== String(sharedPostId)) return null;
    const types = Array.isArray(post.types)
      ? post.types.filter((value) => typeof value === "string" && value)
      : typeof post.type === "string" && post.type ? [post.type] : [];
    return {
      ...post,
      id,
      nickname: String(post.nickname || "REP:ORT"),
      type: String(post.type || types[0] || ""),
      types,
      date: String(post.date || ""),
      time: String(post.time || ""),
      photo: String(post.photo || ""),
      note: String(post.note || ""),
      likes: Array.isArray(post.likes) ? post.likes : [],
      comments: Array.isArray(post.comments) ? post.comments : []
    };
  };

  const firestoreError = (status, message) => {
    const error = new Error(message || `Firestore ${status}`);
    error.status = status;
    return error;
  };

  const fetchFirestoreJson = async (endpoint, options = {}) => {
    const { headers = {}, ...requestOptions } = options;
    const response = await fetch(endpoint.href, {
      cache: "no-store",
      ...requestOptions,
      headers: { Accept: "application/json", ...headers }
    });
    if (!response.ok) throw firestoreError(response.status);
    return response.json();
  };

  const fetchSharedRecordFromFirestore = async () => {
    if (!config.firebaseProjectId || !config.firebaseWebApiKey) {
      throw firestoreError(0, "Firebase web configuration is missing");
    }
    const project = encodeURIComponent(config.firebaseProjectId);
    const database = encodeURIComponent(config.firebaseDatabaseId || "(default)");
    const documentEndpoint = new URL(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents/submissions/${encodeURIComponent(requestedDocumentId)}`
    );
    documentEndpoint.searchParams.set("key", config.firebaseWebApiKey);

    try {
      const documentData = await fetchFirestoreJson(documentEndpoint);
      const direct = normalizeFirestorePost(decodeFirestoreFields(documentData.fields || {}));
      if (direct) return direct;
    } catch (error) {
      // Quota, permission and network failures must not cause a second paid query. Only a
      // missing document can mean legacy data used a different document ID.
      if (!error || error.status !== 404) throw error;
    }

    const queryEndpoint = new URL(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents:runQuery`
    );
    queryEndpoint.searchParams.set("key", config.firebaseWebApiKey);
    const queryResult = await fetchFirestoreJson(queryEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "submissions" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "id" },
              op: "EQUAL",
              value: { integerValue: String(sharedPostId) }
            }
          },
          limit: 1
        }
      })
    });
    const matchedDocument = Array.isArray(queryResult)
      ? queryResult.find((entry) => entry && entry.document && entry.document.fields)
      : null;
    const matched = matchedDocument
      ? normalizeFirestorePost(decodeFirestoreFields(matchedDocument.document.fields))
      : null;
    if (!matched) throw firestoreError(404, "Shared record not found");
    return matched;
  };

  const typeLabel = (types) => {
    const labels = { strength: "💪 근력", cardio: "🏃 유산소", other: "✨ 기타" };
    return (Array.isArray(types) ? types : []).map((type) => labels[type] || type).filter(Boolean).join(" · ");
  };

  const embeddedSharedRecord = () => {
    if (!isSharedRecord) return null;
    const title = String(pageParams.get("title") || "").trim();
    const photo = String(pageParams.get("image") || "").trim();
    if (!title && !photo) return null;
    const count = (name) => Math.min(999, Math.max(0, Number.parseInt(pageParams.get(name) || "0", 10) || 0));
    return {
      id: Number(sharedPostId),
      nickname: title || "REP:ORT",
      date: String(pageParams.get("date") || "").trim(),
      time: String(pageParams.get("time") || "").trim(),
      types: String(pageParams.get("types") || "").split(",").map((value) => value.trim()).filter(Boolean),
      note: String(pageParams.get("note") || "").trim(),
      photo,
      likes: Array.from({ length: count("likes") }),
      comments: Array.from({ length: count("comments") })
    };
  };

  const readCachedSharedRecord = () => {
    if (!isSharedRecord) return null;
    try {
      const cached = JSON.parse(localStorage.getItem(`${SHARED_RECORD_CACHE_PREFIX}${sharedPostId}`) || "null");
      return cached && Number(cached.id) === Number(sharedPostId) ? cached : null;
    } catch (_) {
      return null;
    }
  };

  const cacheSharedRecord = (post) => {
    if (!post || !isSharedRecord) return;
    try {
      localStorage.setItem(`${SHARED_RECORD_CACHE_PREFIX}${sharedPostId}`, JSON.stringify({
        id: Number(sharedPostId),
        nickname: String(post.nickname || "REP:ORT"),
        date: String(post.date || ""),
        time: String(post.time || ""),
        types: Array.isArray(post.types) ? post.types.slice(0, 6) : [],
        note: String(post.note || "").slice(0, 200),
        photo: String(post.photo || ""),
        likes: Array.isArray(post.likes) ? post.likes.slice(0, 999) : [],
        comments: Array.isArray(post.comments) ? post.comments.slice(0, 999) : [],
        cachedAt: Date.now()
      }));
    } catch (_) {
      // 저장 공간이 부족해도 현재 화면 렌더링은 계속합니다.
    }
  };

  const applyUnsupportedPlatformMessage = () => {
    if (!androidUnsupported) return;
    if (sharedRecordInviteButton) {
      sharedRecordInviteButton.textContent = "현재는 안드로이드 앱만 지원됩니다 🥺";
      sharedRecordInviteButton.href = "#";
      sharedRecordInviteButton.setAttribute("aria-disabled", "true");
      sharedRecordInviteButton.classList.add("is-platform-disabled");
      sharedRecordInviteButton.addEventListener("click", (event) => event.preventDefault());
    }
    if (submitButton) {
      submitButton.textContent = "현재는 안드로이드 앱만 지원됩니다 🥺";
      submitButton.disabled = true;
      submitButton.classList.add("is-platform-disabled");
    }
  };

  const revealSharedRecordInvite = () => {
    if (!sharedRecordInvite || !sharedRecordHeart) return;
    sharedRecordInvite.hidden = false;
    sharedRecordHeart.setAttribute("aria-expanded", "true");
    sharedRecordHeart.classList.remove("is-inviting");
    requestAnimationFrame(() => sharedRecordHeart.classList.add("is-inviting"));
    window.setTimeout(() => sharedRecordInvite.scrollIntoView({ behavior: "smooth", block: "nearest" }), 180);
  };

  const openSharedRecordInApp = () => {
    if (!sharedRecordDeepLink) return;
    if (androidUnsupported) {
      revealSharedRecordInvite();
      return;
    }
    let appOpened = false;
    const markOpened = () => { if (document.visibilityState === "hidden") appOpened = true; };
    document.addEventListener("visibilitychange", markOpened, { once: true });
    window.location.href = sharedRecordDeepLink;
    window.setTimeout(() => {
      if (!appOpened && document.visibilityState === "visible") revealSharedRecordInvite();
    }, 1100);
  };

  const renderSharedRecord = (post) => {
    if (!sharedRecordCard || !sharedRecordStatus) return;
    const nickname = String(post.nickname || "REP:ORT").trim() || "REP:ORT";
    const likes = Array.isArray(post.likes) ? post.likes.length : 0;
    const comments = Array.isArray(post.comments) ? post.comments.length : 0;
    const parts = [post.date, post.time, typeLabel(post.types)].filter(Boolean);
    sharedRecordNickname.textContent = nickname;
    sharedRecordAvatar.textContent = nickname.slice(0, 1).toUpperCase();
    sharedRecordMeta.textContent = parts.join(" · ");
    sharedRecordLikeCount.textContent = String(likes);
    sharedRecordCommentCount.textContent = `댓글 ${comments}`;
    sharedRecordNote.textContent = post.note ? `# ${String(post.note).replace(/^#\s*/, "")}` : "";
    sharedRecordNote.hidden = !post.note;

    const photo = String(post.photo || "");
    if (/^(data:image\/|https:\/\/)/i.test(photo)) {
      sharedRecordPhoto.src = photo;
      sharedRecordPhoto.hidden = false;
    } else {
      sharedRecordPhoto.removeAttribute("src");
      sharedRecordPhoto.hidden = true;
    }
    sharedRecordStatus.textContent = "앱이 설치되어 있지 않아 웹에서 기록을 보여드려요.";
    sharedRecordCard.hidden = false;
  };

  const setupSharedRecordPreview = async () => {
    if (!isSharedRecord || !sharedRecordPreview) return;
    if (pageParams.get("fallback") !== "1") {
      const gateway = new URL("record/", config.landingUrl || location.href);
      pageParams.forEach((value, key) => {
        if (key !== "mode" && key !== "fallback") gateway.searchParams.set(key, value);
      });
      gateway.searchParams.set("post", sharedPostId);
      location.replace(gateway.href);
      return;
    }
    document.body.classList.add("record-mode");
    sharedRecordPreview.hidden = false;
    if (sharedRecordHeart) sharedRecordHeart.addEventListener("click", revealSharedRecordInvite);
    if (sharedRecordAppButton) sharedRecordAppButton.addEventListener("click", openSharedRecordInApp);
    if (openSharedRecord) openSharedRecord.addEventListener("click", (event) => {
      event.preventDefault();
      openSharedRecordInApp();
    });

    const embedded = embeddedSharedRecord();
    const cached = readCachedSharedRecord();
    const restored = embedded || cached;
    if (restored) {
      renderSharedRecord(restored);
      sharedRecordStatus.textContent = "Firebase에서 최신 기록을 확인하고 있어요.";
    }
    try {
      const post = await fetchSharedRecordFromFirestore();
      renderSharedRecord(post);
      cacheSharedRecord(post);
    } catch (error) {
      sharedRecordStatus.textContent = restored
        ? "실시간 조회가 지연되어 공유 시점의 기록을 먼저 보여드려요."
        : error && error.status === 429
          ? "서버의 오늘 조회 한도가 소진되었습니다. 앱에서는 저장된 기록을 계속 확인할 수 있어요."
          : "기록을 불러오지 못했습니다. 앱에서 다시 확인해 주세요.";
      if (sharedRecordAppButton) sharedRecordAppButton.hidden = false;
    }
  };

  applyUnsupportedPlatformMessage();
  setupSharedRecordPreview();

  const setupScrollReveal = () => {
    const targets = [...document.querySelectorAll("[data-reveal]")];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!targets.length || reduceMotion || !("IntersectionObserver" in window)) return;

    targets.forEach((element, index) => {
      element.classList.add("reveal-on-scroll");
      element.style.setProperty("--reveal-delay", `${Math.min(index * 70, 140)}ms`);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.14,
      rootMargin: "0px 0px -10% 0px"
    });

    targets.forEach((element) => observer.observe(element));
  };

  setupScrollReveal();

  const setupScrollStories = () => {
    const scenes = [...document.querySelectorAll("[data-scroll-scene]")];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!scenes.length || reduceMotion) return;

    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
    let scheduled = false;

    const update = () => {
      scheduled = false;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      scenes.forEach((scene) => {
        const rect = scene.getBoundingClientRect();
        const distance = Math.max(1, rect.height - viewportHeight * .34);
        const progress = clamp((viewportHeight * .82 - rect.top) / distance);
        const screen = scene.querySelector(".story-screen");
        if (!screen) return;

        if (scene.dataset.scrollScene === "love") {
          const heart = scene.querySelector(".story-heart");
          const warmth = scene.querySelector(".story-warmth");
          const eased = easeOutCubic(progress);
          const spring = Math.sin(progress * Math.PI * 4.2) * (1 - progress) * .11;
          const x = (1 - eased) * screen.clientWidth * 1.08;
          const scale = .7 + eased * .3 + spring;
          const rotate = (1 - eased) * 8;
          if (heart) {
            heart.style.opacity = clamp((progress - .04) / .38).toFixed(3);
            heart.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), -50%, 0) scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(2)}deg)`;
          }
          if (warmth) warmth.style.opacity = (.23 * eased).toFixed(3);
          return;
        }

        const sheet = scene.querySelector(".story-share-sheet");
        const dim = scene.querySelector(".story-share-dim");
        const reportTarget = scene.querySelector(".report-share-target");
        const sheetProgress = easeOutCubic(clamp((progress - .03) / .76));
        const targetProgress = easeOutCubic(clamp((progress - .58) / .42));
        if (sheet) sheet.style.transform = `translate3d(0, ${((1 - sheetProgress) * 108).toFixed(2)}%, 0)`;
        if (dim) dim.style.opacity = (.58 * sheetProgress).toFixed(3);
        if (reportTarget) {
          reportTarget.style.opacity = targetProgress.toFixed(3);
          reportTarget.style.transform = `translate3d(-50%, ${(64 - targetProgress * 100).toFixed(1)}px, 0) scale(${(.88 + targetProgress * .18).toFixed(3)})`;
        }
      });
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
  };

  setupScrollStories();

  const setStatus = (message, kind = "") => {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  };

  const readStoredApplicationTime = () => {
    try {
      return localStorage.getItem(APPLICATION_RECEIVED_AT_KEY);
    } catch (_) {
      return null;
    }
  };

  const storeApplicationTime = (value) => {
    try {
      localStorage.setItem(APPLICATION_RECEIVED_AT_KEY, value);
    } catch (_) {}
  };

  const requestInviteStatus = () => new Promise((resolve, reject) => {
    if (!config.appsScriptEndpoint) {
      reject(new Error("초대 확인 주소가 설정되지 않았습니다."));
      return;
    }

    const callbackName = `__reportInviteStatus_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => finish(new Error("초대 확인 시간이 초과되었습니다.")), 10000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    };
    const finish = (error, value) => {
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };

    window[callbackName] = (payload) => finish(null, payload);
    script.onerror = () => finish(new Error("초대 상태를 확인하지 못했습니다."));
    const endpoint = new URL(config.appsScriptEndpoint);
    endpoint.searchParams.set("action", "invite-status");
    endpoint.searchParams.set("callback", callbackName);
    endpoint.searchParams.set("_", String(Date.now()));
    script.src = endpoint.href;
    document.head.appendChild(script);
  });

  const refreshInviteCompletion = async () => {
    const applicationTime = readStoredApplicationTime();
    if (!inviteCompleteCard || !inviteCompleteTitle || !inviteCompleteDetail || !playStoreCard) return;
    inviteCompleteCard.hidden = false;
    inviteCompleteCard.classList.add("is-checking");
    if (inviteCompleteMark) inviteCompleteMark.textContent = "…";
    inviteCompleteTitle.textContent = "초대 처리 현황";
    inviteCompleteDetail.textContent = "확인 중…";

    try {
      const result = await requestInviteStatus();
      if (!result || !result.ok || !result.completeThrough) throw new Error("invalid invite status");
      const completeThrough = Date.parse(result.completeThrough);
      if (!Number.isFinite(completeThrough)) throw new Error("invalid completeThrough");

      const formatted = new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(completeThrough));

      const submittedAt = Date.parse(applicationTime || "");
      if (Number.isFinite(submittedAt) && submittedAt <= completeThrough) {
        inviteCompleteTitle.textContent = "등록하신 계정의 초대가 완료됐어요.";
        inviteCompleteDetail.textContent = `${formatted} 접수분까지 초대 처리가 완료되었습니다. Google Play에서 REP:ORT를 설치해 주세요.`;
      } else if (Number.isFinite(submittedAt)) {
        inviteCompleteTitle.textContent = "테스트 초대를 순차 처리하고 있어요.";
        inviteCompleteDetail.textContent = `${formatted} 접수분까지 초대가 완료되었습니다. 이후 신청은 순서대로 처리됩니다.`;
      } else {
        inviteCompleteTitle.textContent = "테스트 초대가 완료됐어요 🎉";
        inviteCompleteDetail.textContent = `${formatted} 접수분까지 초대 처리가 완료되었습니다.`;
      }
      inviteCompleteCard.classList.remove("is-checking");
      if (inviteCompleteMark) inviteCompleteMark.textContent = "✓";
      playStoreCard.hidden = false;
    } catch (_) {
      inviteCompleteCard.classList.remove("is-checking");
      if (inviteCompleteMark) inviteCompleteMark.textContent = "!";
      inviteCompleteTitle.textContent = "초대 처리 현황";
      inviteCompleteDetail.textContent = "현재 상태를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
    }
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
    const inviteCode = String(inviteCodeInput && inviteCodeInput.value || "").trim();
    if (!inviteCode || inviteCode.length > 40 || /[\r\n\t]/.test(inviteCode)) {
      if (inviteCodeInput) inviteCodeInput.focus();
      setStatus("초대코드를 입력해 주세요.", "error");
      return;
    }
    if (!config.appsScriptEndpoint) {
      setStatus("신청 접수 주소가 아직 설정되지 않았습니다.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "암호화 중";
    try {
      const submittedAt = new Date().toISOString();
      const ciphertext = await encryptApplication(emailInput.value);
      await fetch(config.appsScriptEndpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          version: 1,
          algorithm: "RSA-OAEP-256",
          ciphertext,
          inviteCode,
          // 새 Apps Script 배포 전에도 코드가 누락되지 않도록 source 열에 호환 사본을 남깁니다.
          source: `github-pages | invite:${inviteCode}`
        })
      });
      storeApplicationTime(submittedAt);
      form.reset();
      setStatus("신청을 안전하게 전송했습니다. 테스트 초대를 기다려 주세요!", "success");
      refreshInviteCompletion();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "신청을 전송하지 못했습니다.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "신청";
    }
  });

  const fallbackShare = async () => {
    const shareData = {
      title: "REP:ORT 앱",
      text: "완벽한 운동보다 오늘 한 운동이 낫습니다. REP:ORT를 앱으로 만나보세요.",
      url: invitationUrl()
    };
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(shareData.url);
    setStatus("테스트 신청 링크를 복사했습니다.", "success");
  };

  const setupKakaoShareButton = () => {
    if (!shareButton) return;
    try {
      if (!window.Kakao || !config.kakaoJavaScriptKey) throw new Error("Kakao SDK unavailable");
      if (!Kakao.isInitialized()) Kakao.init(config.kakaoJavaScriptKey);
      const inviteUrl = invitationUrl();
      const webOnlyLink = {
        mobileWebUrl: inviteUrl,
        webUrl: inviteUrl
      };
      Kakao.Share.createDefaultButton({
        container: "#kakaotalk-sharing-btn",
        objectType: "feed",
        content: {
          title: "REP:ORT 앱 등록",
          description: "운동을 사진으로 기록하고 함께 성장하는 REP:ORT",
          imageUrl: config.imageUrl,
          imageWidth: 512,
          imageHeight: 256,
          link: { ...webOnlyLink }
        },
        buttons: [
          {
            title: "1초 만에 REPORT 초대 등록 하러 가기",
            link: { ...webOnlyLink }
          }
        ]
      });
    } catch (setupError) {
      shareButton.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          await fallbackShare();
        } catch (error) {
          if (error && error.name !== "AbortError") {
            setStatus("공유 창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
          }
        }
      });
    }
  };

  setupKakaoShareButton();
  refreshInviteCompletion();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshInviteCompletion();
  });
})();
