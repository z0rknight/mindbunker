import { buildPayload, emptyAnswers } from "./model.mjs";
import { PUBLIC_STARTING_PATHS, applyExperienceAnswer, buildClientSummary, getVisibleExperienceScreens, selectedExperienceValue } from "./experience.mjs";

const STORAGE_KEY = "rmedia-guided-intake-card-ux-v1";
const root = document.querySelector("#step-root");
const form = document.querySelector("#intake-form");
const backButton = document.querySelector("#back-button");
const continueButton = document.querySelector("#continue-button");
const error = document.querySelector("#form-error");
const progressLabel = document.querySelector("#progress-label");
const progressPercent = document.querySelector("#progress-percent");
const progressFill = document.querySelector("#progress-fill");
const referralNote = document.querySelector("#referral-note");

const params = new URLSearchParams(window.location.search);
const referralSource = params.get("ref")?.toLowerCase() === "pdbm" ? "referral:pdbm" : null;
let state = loadState();
let currentScreenId = state.currentScreenId || "shape";
let resultVisible = false;
let advanceTimer = null;

if (referralSource) {
  referralNote.hidden = false;
  referralNote.textContent = "Referred through Perfect Day Business Mentorship · your referral stays attached, without changing price or creating an automatic discount.";
}

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return saved?.answers
      ? { answers: { ...emptyAnswers(), ...saved.answers, contact: { ...emptyAnswers().contact, ...saved.answers.contact } }, currentScreenId: saved.currentScreenId }
      : { answers: emptyAnswers() };
  } catch {
    return { answers: emptyAnswers() };
  }
}

function persist() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: state.answers, currentScreenId }));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function currentContext() {
  const screens = getVisibleExperienceScreens(state.answers);
  let index = screens.findIndex((screen) => screen.id === currentScreenId);
  if (index < 0) {
    index = Math.max(0, Math.min(screens.length - 1, screens.findIndex((screen) => screen.id === "timing")));
    currentScreenId = screens[index].id;
  }
  return { screens, index, screen: screens[index] };
}

function renderChoice(screen, choice) {
  const selected = selectedExperienceValue(state.answers, screen) === choice.value;
  return `<label class="choice" aria-checked="${selected}">
    <input type="radio" name="${screen.id}" value="${esc(choice.value)}" ${selected ? "checked" : ""} />
    <span class="choice-copy">
      <span class="choice-title">${esc(choice.title)}</span>
      <span class="choice-description">${esc(choice.description)}</span>
    </span>
    <span class="choice-state" aria-hidden="true">Selected</span>
  </label>`;
}

function renderExperience() {
  clearTimeout(advanceTimer);
  resultVisible = false;
  const { screens, index, screen } = currentContext();
  const percent = Math.round(((index + 1) / screens.length) * 100);
  progressLabel.textContent = screen.stage;
  progressPercent.textContent = index >= screens.length - 2 ? "Almost done" : "";
  progressFill.style.width = `${percent}%`;
  backButton.hidden = index === 0;
  backButton.textContent = "Back";
  continueButton.hidden = !screen.contact;
  continueButton.textContent = "Review my starting point";
  error.hidden = true;

  const content = screen.contact
    ? renderContact()
    : `<fieldset class="question-group conversation-group">
        <legend class="sr-only">${esc(screen.title)}</legend>
        <div class="choice-grid">${screen.options.map((choice) => renderChoice(screen, choice)).join("")}</div>
      </fieldset>`;

  root.innerHTML = `<div class="step-view">
    <p class="step-eyebrow">${esc(screen.stage)}</p>
    <h1 class="step-title" id="step-title" tabindex="-1">${esc(screen.title)}</h1>
    <p class="step-hint">${esc(screen.hint)}</p>
    ${content}
    ${screen.contact ? "" : '<p class="auto-hint">Choose one to continue</p>'}
  </div>`;
  bindInputs(screen);
  persist();
  requestAnimationFrame(() => document.querySelector("#step-title")?.focus({ preventScroll: true }));
}

function renderContact() {
  const { contact, freeformContext } = state.answers;
  return `<div class="contact-card">
    <div class="contact-grid">
      <div class="field-wrap">
        <label for="name">Name</label>
        <input class="input" id="name" name="name" autocomplete="name" value="${esc(contact.name)}" required />
      </div>
      <div class="field-wrap">
        <label for="email">Email</label>
        <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="email" value="${esc(contact.email)}" required />
      </div>
      <div class="field-wrap full">
        <label for="company">Business or website <span class="field-help">(optional)</span></label>
        <input class="input" id="company" name="company" autocomplete="organization" value="${esc(contact.company)}" />
      </div>
      <div class="field-wrap full escape-hatch">
        <label for="context">Anything else Emmanuel should know? <span class="field-help">(optional)</span></label>
        <textarea class="textarea" id="context" name="context" maxlength="1200" placeholder="One useful detail, link, or question…">${esc(freeformContext)}</textarea>
        <span class="field-help">A sentence is enough. You do not need to write a production brief.</span>
      </div>
    </div>
  </div>`;
}

function syncSelectedState(value) {
  root.querySelectorAll(".choice").forEach((label) => {
    const input = label.querySelector("input");
    const selected = input?.value === value;
    label.setAttribute("aria-checked", String(selected));
    if (input) input.checked = selected;
  });
}

function bindInputs(screen) {
  root.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", () => {
      state.answers = applyExperienceAnswer(state.answers, screen.id, input.value);
      syncSelectedState(input.value);
      persist();
      advanceTimer = setTimeout(goNext, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 140);
    });
  });
  root.querySelectorAll("input:not([type=radio]), textarea").forEach((input) => {
    input.addEventListener("input", () => {
      if (["name", "email", "company"].includes(input.name)) state.answers.contact[input.name] = input.value;
      if (input.name === "context") state.answers.freeformContext = input.value;
      persist();
    });
  });
}

function goNext() {
  const { screens, index } = currentContext();
  if (index < screens.length - 1) {
    currentScreenId = screens[index + 1].id;
    renderExperience();
  }
}

function validateContact() {
  const email = state.answers.contact.email.trim();
  if (!state.answers.contact.name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return "Add your name and a valid email to review the result.";
  return null;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (resultVisible) {
    state = { answers: emptyAnswers() };
    currentScreenId = "shape";
    sessionStorage.removeItem(STORAGE_KEY);
    renderExperience();
    return;
  }
  const { screen } = currentContext();
  if (!screen.contact) return;
  const message = validateContact();
  if (message) {
    error.textContent = message;
    error.hidden = false;
    error.tabIndex = -1;
    error.focus({ preventScroll: true });
    return;
  }
  renderResult();
});

backButton.addEventListener("click", () => {
  clearTimeout(advanceTimer);
  if (resultVisible) {
    renderExperience();
    return;
  }
  const { screens, index } = currentContext();
  if (index > 0) {
    currentScreenId = screens[index - 1].id;
    renderExperience();
  }
});

function renderResult() {
  resultVisible = true;
  const payload = buildPayload(state.answers, referralSource);
  const summary = buildClientSummary(state.answers);
  const path = PUBLIC_STARTING_PATHS[payload.derived.recommendedStartingPath];
  progressLabel.textContent = "Your starting point";
  progressPercent.textContent = "";
  progressFill.style.width = "100%";
  backButton.hidden = false;
  backButton.textContent = "Edit answers";
  continueButton.hidden = false;
  continueButton.textContent = "Start over";
  root.innerHTML = `<div class="result-card">
    <div>
      <p class="step-eyebrow">A useful summary—not an automatic quote</p>
      <h1 class="step-title" id="step-title" tabindex="-1">This is what Emmanuel will understand.</h1>
      <p class="step-hint">Your answers point to a sensible way to start. Emmanuel still reviews fit, scope, timing, capacity, and price personally.</p>
    </div>
    <dl class="answer-summary">
      <div><dt>What you're making</dt><dd>${esc(summary.making)} · ${esc(summary.content)}</dd></div>
      <div><dt>How often</dt><dd>${esc(summary.frequency)}</dd></div>
      <div><dt>What's ready</dt><dd>${esc(summary.ready)}</dd></div>
      <div><dt>How defined it is</dt><dd>${esc(summary.definition)}</dd></div>
      <div><dt>Timing</dt><dd>${esc(summary.timing)}</dd></div>
    </dl>
    <div class="result-path">
      <span>Likely starting point</span>
      <h2>${esc(path.label)}</h2>
      <p>${esc(path.description)}</p>
      <p class="path-why"><strong>Why this fits:</strong> ${esc(path.why)}</p>
    </div>
    <p class="human-note"><strong>Emmanuel reviews this personally</strong> before confirming scope, timing, availability, or price. Nothing was priced or accepted automatically.</p>
    <details class="disc">
      <summary>Prototype debug payload</summary>
      <div class="body"><pre class="debug-output">${esc(JSON.stringify(payload, null, 2))}</pre></div>
    </details>
  </div>`;
  error.hidden = true;
  requestAnimationFrame(() => document.querySelector("#step-title")?.focus({ preventScroll: true }));
}

renderExperience();
