"use strict";

const SETTINGS = {
    direction: "down",
    questionsLayout: "row",
    answersLayout: "column",

    delayBeforeLeave: 1000,
    stagger: 300,
    leaveDuration: 700,
    fadeDuration: 500,
};

const DIRECTIONS = ["right", "left", "up", "down"];
const LAYOUTS = ["row", "column"];

const params = new URLSearchParams(location.search);

function pick(allowed, ...candidates) {
    return candidates.find((value) => allowed.includes(value));
}

const direction = pick(DIRECTIONS, params.get("direction"), SETTINGS.direction);
const questionsLayout = pick(LAYOUTS, params.get("questions"), SETTINGS.questionsLayout);
const answersLayout = pick(LAYOUTS, params.get("answers"), SETTINGS.answersLayout);

const quiz = document.getElementById("quiz");
const area = document.getElementById("quiz-area"); 
const finished = document.getElementById("finished");
const stats = document.getElementById("stats");
const restartButton = document.getElementById("restart");

area.dataset.questions = questionsLayout;
area.dataset.answers = answersLayout;
quiz.style.setProperty("--leave-ms", SETTINGS.leaveDuration + "ms");
quiz.style.setProperty("--fade-ms", SETTINGS.fadeDuration + "ms");

let items = [];
let busy = false;
let reviewItem = null;

function shuffle(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function create(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function press(element) {
    element.classList.remove("pressed");
    void element.offsetWidth;
    element.classList.add("pressed");
}

function allDone() {
    return items.every((item) => item.done);
}

function updateClickable() {
    const review = allDone();
    items.forEach((item) => {
        const can = review || (!busy && !item.answered);
        item.questionEl.classList.toggle("clickable", can);
    });
}

function start() {
    area.innerHTML = "";
    finished.hidden = true;
    busy = false;
    reviewItem = null;

    items = shuffle(QUESTIONS).map((data, index) => createItem(data, index));
    area.appendChild(items[0].el); 
    updateClickable();
}

function createItem(data, index) {
    const item = {
        data: data,
        el: create("div", "item"),
        questionEl: create("button", "block question", `${index + 1}. ${data.question}`),
        answersEl: create("div", "answers"),
        answered: false,
        done: false,
    };
    item.questionEl.type = "button";
    item.questionEl.addEventListener("click", () => onQuestionClick(item));
    item.el.append(item.questionEl, item.answersEl);
    return item;
}


function onQuestionClick(item) {
    if (allDone()) {
        toggleReview(item);
        return;
    }
    if (busy || item.answered) return;
    busy = true;
    item.questionEl.classList.remove("pressed");
    showAnswers(item);
    updateClickable();
}

function showAnswers(item) {
    const list = item.data.answers.map((text, index) => ({
        text: text,
        isCorrect: item.data.correct.includes(index),
    }));

    shuffle(list).forEach((answer) => {
        const el = create("button", "block answer clickable", answer.text);
        el.type = "button";
        el.addEventListener("click", () => onAnswerClick(item, el, answer.isCorrect));
        item.answersEl.appendChild(el);
    });
}


async function onAnswerClick(item, answerEl, isCorrect) {
    if (item.answered) return;
    item.answered = true;
    item.isRight = isCorrect;

    press(answerEl);
    item.answersEl
        .querySelectorAll(".answer")
        .forEach((el) => el.classList.remove("clickable"));

    if (isCorrect) {
        answerEl.classList.add("correct");
        addExplanation(answerEl, item.data.explanation);
    }

    await wait(SETTINGS.delayBeforeLeave);

    addMarker(item, isCorrect);

    const all = Array.from(item.answersEl.children);
    const leaving = isCorrect ? all.filter((el) => el !== answerEl) : all;
    await leave(leaving);

    if (isCorrect) {
        answerEl.classList.add("fading");
        await wait(SETTINGS.fadeDuration);
        answerEl.remove();
    }

    item.done = true;
    busy = false;
    if (allDone()) {
        finish();
    } else {
        area.appendChild(items.find((it) => !it.el.isConnected).el);
        updateClickable();
    }
}

function addExplanation(answerEl, text) {
    if (!text) return;
    answerEl.appendChild(create("span", "explain", text));
}

function addMarker(item, isCorrect) {
    const marker = create("span", "marker " + (isCorrect ? "ok" : "bad"), isCorrect ? "✔" : "✖");
    item.questionEl.appendChild(marker);
}

function leave(blocks) {
    const stage = area.getBoundingClientRect();
    const extra = 30;

    blocks.forEach((block, index) => {
        const rect = block.getBoundingClientRect();
        let dx = 0;
        let dy = 0;

        if (direction === "right") dx = stage.right - rect.left + extra;
        if (direction === "left") dx = -(rect.right - stage.left + extra);
        if (direction === "down") dy = stage.bottom - rect.top + extra;
        if (direction === "up") dy = -(rect.bottom - stage.top + extra);

        block.style.setProperty("--dx", dx + "px");
        block.style.setProperty("--dy", dy + "px");
        block.style.setProperty("--delay", index * SETTINGS.stagger + "ms");
        block.classList.add("leaving");
    });

    const total = Math.max(blocks.length - 1, 0) * SETTINGS.stagger + SETTINGS.leaveDuration;
    return wait(total + 50).then(() => blocks.forEach((block) => block.remove()));
}


function finish() {
    const right = items.filter((item) => item.isRight).length;
    stats.textContent = `Правильных ответов: ${right} из ${items.length}`;
    finished.hidden = false;
    updateClickable();
}

function toggleReview(item) {
    const same = reviewItem === item;
    if (reviewItem) {
        reviewItem.answersEl.innerHTML = "";
        reviewItem = null;
    }
    if (same) return;

    item.data.correct.forEach((index) => {
        const el = create("div", "block answer correct", item.data.answers[index]);
        addExplanation(el, item.data.explanation);
        item.answersEl.appendChild(el);
    });
    reviewItem = item;
}

restartButton.addEventListener("click", start);

start();
