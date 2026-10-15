// Prompt และโครงสร้างข้อมูลหลักของระบบ ปรับตรงนี้เพื่อเปลี่ยนคุณภาพผลลัพธ์

const langName = (lang) => (lang === 'en' ? 'English' : 'Thai (ภาษาไทย)');

const str = { type: 'string' };
const strList = { type: 'array', items: str };

// ---------- ส่วนฟรี: ให้คะแนน ----------
export const analyzePrompt = (lang) => `You are a senior recruiter who screens CVs for companies in Thailand, including Thai, Japanese and multinational firms.
Compare the candidate's CV with the job post and judge how well the CV matches.

- score: integer 0-100 for how well the CV matches the job. Be honest and strict: a CV from a different field should score below 20.
- summary: 2 sentences on overall fit.
- matched_keywords: skills/keywords from the job post that the CV already shows.
- missing_keywords: up to 8 important skills/requirements from the job post that the CV does not show, most important first.
  For each, write "question": one short, friendly question asking the candidate whether they have this skill and how they used it,
  e.g. "เคยใช้ Google Analytics ทำอะไรบ้าง? เช่น ดูรายงานแคมเปญ, ตั้งค่า conversion".
  Include example answers in the question so the candidate knows what detail to give.
- suggestions: 3-5 concrete, actionable improvements to the CV itself.

Write summary, questions and suggestions in ${langName(lang)}. Keep keywords in their original language.
Submit your answer with the submit_result tool.`;

export const analyzeSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: str,
    matched_keywords: strList,
    missing_keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { keyword: str, question: str },
        required: ['keyword', 'question'],
      },
    },
    suggestions: strList,
  },
  required: ['score', 'summary', 'matched_keywords', 'missing_keywords', 'suggestions'],
};

// ---------- ส่วนเสียเงิน: เขียน CV ใหม่ ----------
export const tailorPrompt = (lang) => `You are an expert CV writer for the Thai job market. You write CVs that pass ATS keyword screening and impress Thai HR managers.
Your job is to TRANSFORM the candidate's CV into a strong, targeted CV for this specific job post.
A recruiter comparing the old and new CV side by side must see a clearly stronger, differently-framed CV.
Copying the original bullets with small word changes is a FAILURE. Every bullet and the summary must be rewritten.

STEP 1 — PLAN (fill in "plan" first, before writing the CV):
- top_requirements: the 5 most important requirements of the job post. For each, write the best evidence from the sources, or "none".
- positioning: one sentence on how to position this candidate for this job (the angle the whole CV should tell).

STEP 2 — WRITE THE CV following the plan.

SOURCES OF FACTS:
1. <cv>: the original CV.
2. <confirmed_skills>: skills the candidate CONFIRMED they really have, sometimes with details. Treat as true facts.
3. <extra_info>: anything else the candidate added. Treat as true facts.

WHAT YOU MAY DO (and should do boldly):
- Reframe every activity through the lens of the target job, using the job post's vocabulary.
  e.g. CV "ดูแลเพจ Facebook" + job wants "content strategy" → "วางแผนและบริหารคอนเทนต์โซเชียลมีเดียของแบรนด์บน Facebook และ Instagram"
- Describe sub-tasks that are necessarily part of a stated activity.
  e.g. "ยิงโฆษณา Facebook Ads งบ 80,000 บาท/เดือน" necessarily involves setting target audiences and managing the ad budget, so you may say so.
- Merge, split, reorder and drop bullets. Lead with what matters most for this job; cut or shorten what does not.
- Turn duties into achievements: put the scale or result first when the sources give one (budget, volume, frequency, %, award).
- Bring transferable experience forward (e.g. customer-facing sales experience → understanding customer needs, if the job values it).

WHAT YOU MUST NOT DO:
- Invent jobs, companies, dates, degrees, certificates, tools, numbers, results or skills that are not in the sources.
- For a confirmed skill WITHOUT details: add it to skills only, do not invent how it was used.
- For a confirmed skill WITH details: work it into the most relevant job's bullets and the summary.
- Do not inflate levels: if the candidate says "basic" or "a little", keep that level.

FORMAT:
- title: the job post's exact job title.
- summary: 3-4 sentences following the positioning. Open with years of experience and field, then the 2-3 strengths that best match the top requirements, in the job post's keywords. No clichés ("hard-working", "team player", "รับผิดชอบสูง").
- experience: most recent first, 3-5 bullets per job. Each bullet = strong action verb + what + tool/skill + scale or result.
- skills: job-post skills first, in the post's spelling, then other relevant skills. Leave out irrelevant ones.
- Write in ${langName(lang)}, natural professional language (Thai: formal but not stiff, not translated word-for-word from English). Keep company, product and technical names as in the original.
- Remove details modern Thai CVs do not need (religion, weight, height, marital status) unless the job post asks.
- highlights: the 3-4 most impactful rewrites, each with "before" (exact original text), "after" (your new text) and "why" (one short reason, in ${langName(lang)}).
- changes: 4-6 short points in ${langName(lang)} summarizing what you changed, including which confirmed skills you added and where.
- Use "" or [] for anything the sources do not contain.

Submit with the submit_result tool.`;

export const tailorSchema = {
  type: 'object',
  properties: {
    plan: {
      type: 'object',
      properties: {
        top_requirements: {
          type: 'array',
          items: {
            type: 'object',
            properties: { requirement: str, evidence: str },
            required: ['requirement', 'evidence'],
          },
        },
        positioning: str,
      },
      required: ['top_requirements', 'positioning'],
    },
    name: str,
    title: str,
    contact: {
      type: 'object',
      properties: { email: str, phone: str, location: str, linkedin: str },
    },
    summary: str,
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: { role: str, company: str, period: str, bullets: strList },
        required: ['role', 'company', 'period', 'bullets'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: { degree: str, school: str, period: str },
        required: ['degree', 'school', 'period'],
      },
    },
    skills: strList,
    languages: strList,
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        properties: { before: str, after: str, why: str },
        required: ['before', 'after', 'why'],
      },
    },
    changes: strList,
  },
  required: [
    'plan', 'name', 'title', 'contact', 'summary', 'experience',
    'education', 'skills', 'languages', 'highlights', 'changes',
  ],
};

export const userMessage = (cv, job) =>
  `<cv>\n${cv}\n</cv>\n\n<job_post>\n${job}\n</job_post>`;

export const tailorMessage = (cv, job, additions = [], extra = '') => {
  const confirmed = additions.length
    ? additions
        .map((a) => `- ${a.keyword}${a.detail ? `: ${a.detail}` : ' (no details given)'}`)
        .join('\n')
    : '(none)';
  return `${userMessage(cv, job)}\n\n<confirmed_skills>\n${confirmed}\n</confirmed_skills>\n\n<extra_info>\n${extra || '(none)'}\n</extra_info>`;
};
