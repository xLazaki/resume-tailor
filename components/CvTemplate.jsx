// เทมเพลต CV ที่ใช้แสดงผลและพิมพ์เป็น PDF
// theme: modern (เรียบหรู) | classic (ทางการ) | creative (มีสีและรูป)

export const THEMES = [
  { id: 'modern', name: 'เรียบหรู', hint: 'เหมาะกับทุกสายงาน' },
  { id: 'classic', name: 'ทางการ', hint: 'บัญชี ราชการ ธนาคาร' },
  { id: 'creative', name: 'มีสีสัน', hint: 'การตลาด ครีเอทีฟ ไอที' },
];

export const ACCENTS = [
  { id: 'green', color: '#0f6e56', name: 'เขียว' },
  { id: 'navy', color: '#1f3a5f', name: 'กรมท่า' },
  { id: 'wine', color: '#7a2840', name: 'แดงเลือดหมู' },
  { id: 'charcoal', color: '#333333', name: 'เทาเข้ม' },
  { id: 'orange', color: '#b8541c', name: 'ส้มอิฐ' },
];

const has = (arr) => Array.isArray(arr) && arr.filter(Boolean).length > 0;
const list = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

function Experience({ data }) {
  if (!has(data.experience)) return null;
  return (
    <section>
      <h2>ประสบการณ์ทำงาน / Experience</h2>
      {data.experience.map((job, i) => (
        <div className="cv-item" key={i}>
          <div className="cv-row">
            <strong>{job.role}</strong>
            <span className="cv-period">{job.period}</span>
          </div>
          <div className="cv-org">{job.company}</div>
          {has(job.bullets) && (
            <ul>
              {list(job.bullets).map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

function Education({ data }) {
  if (!has(data.education)) return null;
  return (
    <section>
      <h2>การศึกษา / Education</h2>
      {data.education.map((ed, i) => (
        <div className="cv-item" key={i}>
          <div className="cv-row">
            <strong>{ed.degree}</strong>
            <span className="cv-period">{ed.period}</span>
          </div>
          <div className="cv-org">{ed.school}</div>
        </div>
      ))}
    </section>
  );
}

function Summary({ data }) {
  if (!data.summary) return null;
  return (
    <section>
      <h2>สรุปโปรไฟล์ / Profile</h2>
      <p>{data.summary}</p>
    </section>
  );
}

function Inline({ title, items }) {
  if (!has(items)) return null;
  return (
    <section>
      <h2>{title}</h2>
      <p>{list(items).join(' · ')}</p>
    </section>
  );
}

function Stacked({ title, items }) {
  if (!has(items)) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul className="cv-plain">
        {list(items).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

export default function CvTemplate({ data, theme = 'modern', accent = '#0f6e56', photo = '' }) {
  const c = data.contact || {};
  const contact = [c.email, c.phone, c.location, c.linkedin].filter(Boolean);
  const style = { '--cv-accent': accent };

  if (theme === 'creative') {
    return (
      <article className="cv t-creative" style={style}>
        <aside className="cv-side">
          {photo && <img className="cv-photo round" src={photo} alt="" />}
          <h1>{data.name}</h1>
          {data.title && <p className="cv-title">{data.title}</p>}
          {contact.length > 0 && (
            <section>
              <h2>ติดต่อ / Contact</h2>
              <ul className="cv-plain">
                {contact.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          )}
          <Stacked title="ทักษะ / Skills" items={data.skills} />
          <Stacked title="ภาษา / Languages" items={data.languages} />
        </aside>
        <div className="cv-main">
          <Summary data={data} />
          <Experience data={data} />
          <Education data={data} />
        </div>
      </article>
    );
  }

  return (
    <article className={`cv t-${theme === 'classic' ? 'classic' : 'modern'}`} style={style}>
      <header className="cv-head">
        {photo && <img className={'cv-photo' + (theme === 'modern' ? ' round' : '')} src={photo} alt="" />}
        <div className="cv-head-text">
          <h1>{data.name}</h1>
          {data.title && <p className="cv-title">{data.title}</p>}
          {contact.length > 0 && <p className="cv-contact">{contact.join('  ·  ')}</p>}
        </div>
      </header>
      <Summary data={data} />
      <Experience data={data} />
      <Education data={data} />
      <Inline title="ทักษะ / Skills" items={data.skills} />
      <Inline title="ภาษา / Languages" items={data.languages} />
    </article>
  );
}
