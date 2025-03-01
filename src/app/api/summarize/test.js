import pkg from "@screenpipe/js";
const { pipe, OCRContent } = pkg;


const test = await pipe.settings.getAll()
const t= test.openaiApiKey

console.log(t)