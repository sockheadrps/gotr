# Gospel of the Real (GOTR)

This repo serves the **static chapter payloads** for the Gospel of the Real site/app. The data in `static/chapters/*` is generated from the gospel pipeline and then copied here for the frontend to consume.

## How the data was gathered
1. **Discord philosophy archive → topic files**
   - Discord conversations were distilled into topical files in `/home/nonsrs/code_projects/philosophy-profile/`.
   - Each file captures the author’s positions, quotes, and evidence for one topic.

2. **Gospel chapters written from those topics**
   - **`gospel-writer` skill** uses the topic files to write each chapter’s `ORIGINAL.md` in `/home/nonsrs/code_projects/gospel/chapter-XX-*`.
   - Original prompt used:
     > "Can you make a new folder called gospel, go there, and the plan is going to be that its a book, much like the bible, and using each one of those 10 topics, wrangle them into 10 chapters for the book, and write a prophetic, inspiring allegory-esk short story using the info from each topic, and try to use the same tone and vernacular I would use in the writing."

3. **Data files generated from each chapter**
   - **`gospel-data-generator` skill** creates:
     - `summary.json`
     - `source.json` (Discord evidence + quotes)
     - `audio_chunks.json` (TTS-ready chunks)
   - Run prompts/commands:
     - `python3 /path/to/generate.py --chapter 7`
     - `python3 /path/to/generate.py --next`
     - `python3 /path/to/generate.py --all`
   - Output lives in each chapter folder in `/home/nonsrs/code_projects/gospel/`.

4. **Optional chapter iterations**
   - **`gospel-iter` skill** can produce alternate versions under `iterations/iteration-N/` with their own `iteration.md`, `summary.json`, and `audio_chunks.json`.
   - Iteration prompt used:
     > "Edit and iterate on this allegory, keep the emotionally and intellectually charging parts and see if you can improve it. If there is a common phrase or statement or specific choice of words from the source context made by Ryan ('Author') that will preserve the voice of the Author in the story by using verbatim or closely paraphrasing, preserve that aspect when creating the story"

## How those skills feed GOTR
The generated chapter assets are copied into this repo under:

```
/static/chapters/chapter-XX-*/
  ORIGINAL.md
  summary.json
  source.json
  audio_chunks.json
  img.png
  chapter.json   # tracks active_iteration
```

`chapter.json` currently stores the active iteration index for the frontend.

---

If you need new chapters or refreshed data, run the gospel skills to update `/home/nonsrs/code_projects/gospel/`, then copy the updated chapter folders into `gotr/static/chapters/`.
