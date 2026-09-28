-- REAL SITE CONTENT — part of the production initial setup.
--
-- Everything under supabase/content/ is true of production: Tony Klinger's
-- real products, prices, curriculum, works, writing and team, migrated from
-- the three source sites. It reaches a deployed project through
-- `pnpm content:setup` (scripts/setup-content.mjs), and the local database
-- through `supabase db reset`, which loads these files before seed.sql
-- (config.toml [db.seed]).
--
-- Local-only fixtures — test accounts, their entitlements, placeholder rows —
-- do NOT belong here. They live in seed.sql.
--
-- No begin/commit in these files: the setup script runs them all in ONE
-- transaction, so a failure part-way leaves production untouched.
--
-- Products, prices, memberships, cohorts, courses and lessons.

-- ---------------------------------------------------------------------------
-- Real commercial catalogue, migrated from the three source sites.
-- See current-website/README.md for provenance.

-- Real content, migrated from the three source sites.
--
-- JOINED DELIBERATELY, because each source is authoritative for something
-- different and none is authoritative for everything:
--
--   tonyklingercoaching.com   REAL PRICES. The Wix Store and Bookings pages are
--                             what customers actually paid against.
--   tonyklingeronlinecoaching REAL CURRICULUM. The course app holds the 42
--                             lessons and 24 cohort sessions with their copy.
--   tonydklinger.com          The catalogue of works, already migrated.
--
-- The course app's own prices are all 1.00 — placeholder values from
-- development, not real money — so prices come from the storefront and content
-- comes from the app. Taking prices from the app would have published a £1
-- course.

-- Membership products. Prices per /plans-pricing: a monthly subscription and
-- a one-year one-off exist side by side for each tier, so each product
-- carries two prices rather than being split into two products.

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Silver Membership', 'membership-silver', 'membership',
    'Silver membership — cumulative access, including everything in the tiers below it.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
), m as (
  insert into prices (product_id, currency, amount, billing_type, interval, active)
  select id, 'GBP', 1500, 'recurring', 'month', true from p
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 16000, 'one_time', true from p;

update membership_tiers set product_id = (select id from products where slug = 'membership-silver'),
       description = 'A first series and a playlist — the way in, at the lowest commitment.',
       benefits = array[
         'One Group Coaching series — eight sessions',
         'A video playlist of your choice'
       ]
 where tier = 'silver';

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Gold Membership', 'membership-gold', 'membership',
    'Gold membership — cumulative access, including everything in the tiers below it.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
), m as (
  insert into prices (product_id, currency, amount, billing_type, interval, active)
  select id, 'GBP', 3500, 'recurring', 'month', true from p
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 28000, 'one_time', true from p;

update membership_tiers set product_id = (select id from products where slug = 'membership-gold'),
       description = 'Two Group Coaching series, the full video playlist library, and live hour-long Q&A sessions.',
       benefits = array[
         'Two Group Coaching series — sixteen sessions in total',
         'Access to every video playlist, including the Miscellaneous playlist',
         'Live hour-long Q&A sessions'
       ]
 where tier = 'gold';

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Platinum Membership', 'membership-platinum', 'membership',
    'Platinum membership — cumulative access, including everything in the tiers below it.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
), m as (
  insert into prices (product_id, currency, amount, billing_type, interval, active)
  select id, 'GBP', 7000, 'recurring', 'month', true from p
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 56000, 'one_time', true from p;

update membership_tiers set product_id = (select id from products where slug = 'membership-platinum'),
       description = 'All four Group Coaching series, virtual retreats, and new courses added throughout your membership.',
       benefits = array[
         'All four Group Coaching series — the full thirty-two sessions',
         'Virtual retreats',
         'New courses added during your membership'
       ]
 where tier = 'platinum';

-- Courses. Levels 1-3 are the storefront's real products; the 'Movie' course in
-- the app is the curriculum that sits behind them.

-- Named as the courses are (2026-09-26), so the cart and the order record
-- say what was bought rather than "Level One".
with p as (
  insert into products (name, slug, product_type, description, status)
  values ('The Basics of Movie Production', 'course-level-one', 'course', 'Level One.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 19950, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('How to Get Your Movie Made', 'course-level-two', 'course', 'Level Two.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 39950, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Level Three', 'course-level-three', 'course', 'Advanced movie production and getting made.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 49950, 'one_time', true from p;

-- Bundles. 'The Deluxe' and its level bundles are the storefront's premium
-- offers; note 01's Ultimate tier has no equivalent in any source site, so it is
-- deliberately left unpriced rather than guessed at.

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('The Deluxe', 'bundle-the-deluxe', 'bundle', 'The Deluxe — combined coaching and course access.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 64950, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('The Deluxe — Level 1 Bundle', 'bundle-deluxe-level-1', 'bundle', 'The Deluxe — Level 1 Bundle — combined coaching and course access.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 74900, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('The Deluxe — Level 2 Bundle', 'bundle-deluxe-level-2', 'bundle', 'The Deluxe — Level 2 Bundle — combined coaching and course access.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 90000, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('The Deluxe — Level 3 Bundle', 'bundle-deluxe-level-3', 'bundle', 'The Deluxe — Level 3 Bundle — combined coaching and course access.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 105950, 'one_time', true from p;

-- Coaching services, from the Bookings pages. A single session and an
-- eight-session bundle are separate products because they are separately
-- purchasable, and the bundle grants consumable credits.

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Group Coaching — Single Session', 'group-coaching-single', 'group_coaching', 'One virtual seat in any group session.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 2500, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Group Coaching — 8 Sessions', 'group-coaching-x8', 'group_coaching', 'Eight group coaching sessions. Valid for three months.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 13000, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Advanced One-to-One — Single', 'one-to-one-single', 'private_coaching', 'One advanced one-to-one coaching session.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 15000, 'one_time', true from p;

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Advanced One-to-One — 8 Sessions', 'one-to-one-x8', 'private_coaching', 'The eight-session one-to-one offer.', 'active')
  on conflict (slug) do update set name = excluded.name returning id
)
insert into prices (product_id, currency, amount, billing_type, active)
select id, 'GBP', 13000, 'one_time', true from p;

-- Interactive cohorts. £699 per level, eight three-hour Zoom workshops.
-- COHORT LEVEL IS NOT A MEMBERSHIP TIER (R17) — the names coincide, the
-- concepts do not.

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Interactive Coaching Cohort — Gold', 'cohort-gold', 'cohort',
    'Intermediate Interactive Coaching Cohort', 'active')
  on conflict (slug) do update set name = excluded.name returning id
), pr as (
  insert into prices (product_id, currency, amount, billing_type, active)
  select id, 'GBP', 69900, 'one_time', true from p
)
insert into cohorts (product_id, name, slug, description, benefits, cohort_level, capacity, status)
select id, 'Interactive Coaching Cohort — Gold', 'cohort-gold',
       'Intermediate Interactive Coaching Cohort',
       array[
       'Eight x 3 hour live Zoom workshops',
       'By completing the Gold level, you move from preparing for the industry to actively operating within it!',
       'You will develop the emotional resilience to function under real pressure, the discipline to produce work consistently and the professional judgement to make smart decisions about projects, collaborators and opportunities.',
       'You will learn how to write reliably rather than sporadically, how to pitch with clarity and confidence, how to collaborate as someone others trust and how to navigate the business realities that underpin every creative career.',
       'You’ll gain the ability to read people and situations accurately, knowing who to work with, when to push forward, when to set boundaries and when to walk away.',
       'By the end of Gold, you won’t just feel more confident - you will behave like a professional: calmer, clearer, more strategic and more credible.',
       'This level is about becoming someone the industry takes seriously, because you take yourself, your work and your career seriously.'
       ],
       'gold', 12, 'published' from p
on conflict (slug) do update set description = excluded.description,
  benefits = excluded.benefits, status = 'published';

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Interactive Coaching Cohort — Platinum', 'cohort-platinum', 'cohort',
    'Advanced Interactive Coaching Cohort', 'active')
  on conflict (slug) do update set name = excluded.name returning id
), pr as (
  insert into prices (product_id, currency, amount, billing_type, active)
  select id, 'GBP', 69900, 'one_time', true from p
)
insert into cohorts (product_id, name, slug, description, benefits, cohort_level, capacity, status)
select id, 'Interactive Coaching Cohort — Platinum', 'cohort-platinum',
       'Advanced Interactive Coaching Cohort',
       array[
       'Eight x 3 hour live Zoom workshops',
       'By completing the Platinum level, you step fully into the role of a senior creative professional, someone who executes decisively, chooses strategically and understands the industry as a system rather than a mystery.',
       'You will learn how to move from talk to sustained action, how to protect and harness peak creative performance and how to recognise and correct the behaviours that quietly limit long-term success.',
       'You will develop projects that are not only creatively strong but pitch-perfect, viable and aligned with your professional identity and you will gain the confidence to present them clearly to funders, collaborators, and decision-makers.',
       'You’ll understand how money flows through creative work, how to raise finance, how distribution and visibility shape careers and how reputation, reliability and good PR create momentum over time.',
       'By the end of Platinum, you won’t just be “trying to break in” - you will be operating with clarity, authority and self-trust, able to make informed choices, sustain a living creative practice and position yourself as someone others want to invest in, collaborate with, and follow.'
       ],
       'platinum', 12, 'published' from p
on conflict (slug) do update set description = excluded.description,
  benefits = excluded.benefits, status = 'published';

with p as (
  insert into products (name, slug, product_type, description, status)
  values ('Interactive Coaching Cohort — Silver', 'cohort-silver', 'cohort',
    'Beginners Interactive Coaching Cohort', 'active')
  on conflict (slug) do update set name = excluded.name returning id
), pr as (
  insert into prices (product_id, currency, amount, billing_type, active)
  select id, 'GBP', 69900, 'one_time', true from p
)
insert into cohorts (product_id, name, slug, description, benefits, cohort_level, capacity, status)
select id, 'Interactive Coaching Cohort — Silver', 'cohort-silver',
       'Beginners Interactive Coaching Cohort',
       array[
       'Eight x 3 hour live Zoom workshops',
       'By the end of the Silver level, you will have transformed uncertainty into clarity and hesitation into forward motion.',
       'You’ll understand where you fit in the film industry, what skills you already possess, and how to build the ones you need next — without overwhelm or wasted effort.',
       'You’ll know how to train strategically, start small, build a focused portfolio, and present yourself professionally so people can quickly understand who you are and what you do.',
       'You’ll learn how to network calmly and authentically, approach mentors with confidence, make the most of internships and begin positioning yourself within real industry ecosystems, locally and globally.',
       ' Crucially, you’ll develop the habits that sustain a career: clear communication, professional writing, adaptability, resilience, patience and momentum.',
       'This level is about becoming credible, grounded and ready - someone who doesn’t just dream about working in film, but is actively building a path into it, one intelligent step at a time.'
       ],
       'silver', 12, 'published' from p
on conflict (slug) do update set description = excluded.description,
  benefits = excluded.benefits, status = 'published';


-- Course curriculum, migrated from the course app's own database export.
--
-- 42 lessons with their full markdown. The storefront named the products
-- (Level One, Level Two) and priced them; the app holds what is actually taught.
--
-- VIDEO IS NOW MIGRATED TOO — see 05_lesson_video.sql.
--
-- It was left out because `lessons` had no video column and Livid, not YouTube,
-- was the decided host; pointing a new column at YouTube would have overturned
-- that decision silently. Both objections are now answered: migration 0007_staff_accounts_and_lesson_video adds
-- the column as a (provider, id) pair so the host is a data value rather than a
-- commitment, the entitlement gate exists and is tested, and the owner has
-- decided YouTube stays until the videos are re-uploaded to Livid (R29).


with c as (
  -- TITLED BY WHAT IT PROMISES, NOT ITS PLACE IN A SEQUENCE (owner,
  -- 2026-09-26): the level is a small label (`level`, migration 0016), and the
  -- description says what the lessons actually cover. Listed second: How to
  -- Get Your Movie Made leads. Neither course is a prerequisite of the other
  -- — this one is about getting into the industry, Level Two about getting
  -- your own film made.
  insert into courses (product_id, title, slug, description, status, level, position)
  select id, 'The Basics of Movie Production', 'level-one',
    'How to get into the film industry and stay there: training, networking, a portfolio, internships, finding a mentor and marketing yourself.',
    'published', 'Level One', 20 from products where slug = 'course-level-one'
  on conflict (slug) do update set title = excluded.title, description = excluded.description, level = excluded.level, position = excluded.position returning id
), m as (
  insert into course_modules (course_id, title, description, position)
  select id, 'Level One — Curriculum', '20 lessons.', 1 from c
  returning id
)
insert into lessons (module_id, title, slug, content, position, status)
select m.id, v.title, v.slug, v.content, v.position, 'published'
from m, (values
  ('Education Training', 'education-training', 'Remember, there is no one-size-fits-all method to getting into the movie industry. Cultivating relationships, demonstrating your passion through your work, and continuously striving for growth and learning are key components of success in this dynamic field.

The film and movie industry values both formal education and practical experience. Graduating from a prestigious program can open doors and aid in networking, but ultimately, skills, creativity, and experience are key factors in this industry. Here are some of the best colleges and universities in the U.K. and the USA for education and training in film and movie production:

### In the United Kingdom:

-   **National Film and Television School (NFTS):** Known for its hands-on approach and industry connections, NFTS is highly regarded for film, television, and new media education.
-   **London Film School (LFS):** One of the oldest film schools in the world, LFS offers postgraduate degrees with an emphasis on technical, directing, and producing skills.
-   **Bournemouth University:** Offers various programs focusing on different aspects of filmmaking, including animation and visual effects.
-   **Film Academy at the University of Edinburgh:** Offers degrees that combine theory and practical experience in film studies.
-   **Central Saint Martins:** Part of the University of the Arts London, it offers courses that blend film theory with creative practice.

### In the United States:

-   **University of Southern California (USC) School of Cinematic Arts:** Located in the heart of Los Angeles, USC has produced many successful filmmakers and is known for its state-of-the-art facilities and industry connections.
-   **New York University (NYU) Tisch School of the Arts:** NYU Tisch provides comprehensive film programs and opportunities to create a diverse portfolio, with proximity to the bustling New York film scene.
-   **American Film Institute (AFI):** Known for its conservatory approach, AFI focuses on specialty disciplines in filmmaking, offering hands-on training.
-   **University of California, Los Angeles (UCLA) School of Theater, Film, and Television:** Offering a balance between theory and practical application, UCLA has a storied history and strong industry ties.
-   **California Institute of the Arts (CalArts):** Provides an interdisciplinary approach that encourages innovation and collaboration across various artistic fields.
-   **Columbia University School of the Arts:** Offers graduate programs in film studies with a strong emphasis on storytelling and technical craftsmanship.

The film industry does recognize candidates graduating from these programs, as they often provide a strong foundation in both theoretical and practical aspects of filmmaking. Additionally, these institutions often encourage networking, which can be crucial for career growth. Internships, film festivals, and alumni connections provided by these schools can lead to opportunities within the industry.

However, it is important to note that the industry also greatly values hands-on experience, a diverse portfolio, and the ability to adapt and innovate. Many successful filmmakers have taken alternative paths into industry, including self-taught routes, short courses, apprenticeships, or starting their careers as assistants and working their way up. Ultimately, the combination of education, real-world experience, creativity, and persistence is key to a successful career in the movie industry.', 1),
  ('Networking', 'networking', 'Achieving the best possible networking outcomes in the movie industry as a newcomer involves a combination of strategic relationship-building, persistent effort, developing your craft, and leveraging available resources. Here is a detailed approach with examples:

1.   **Educate Yourself:** Understanding the industry is vital. Familiarize yourself with its history, current trends, key players (producers, directors, actors, etc.), and how projects are developed from concept to premiere. Reading trade publications like Variety or The Hollywood Reporter can provide current insights.

2.   **Develop Your Craft:** Whether you’re an actor, writer, director, or technician, continually improving your skills is crucial. Take classes, workshops, and engage in projects (e.g., student films, indie projects) to gain experience and build a portfolio.

3.  **Create an Online Presence:** Maintain professional social media profiles and a personal website showcasing your work. Platforms like LinkedIn, Twitter, and Instagram are valuable for connecting with industry professionals. For example, a screenwriter might share a well-received short script online to attract attention.

4. **Attend Industry Events:** Film festivals, conferences, and workshops offer great opportunities to meet peers and industry veterans. Practice your elevator pitch, bring your business cards, and engage in genuine conversations. For instance, attending Sundance could lead to meeting independent producers looking for fresh talent.

5. **Network Locally:** Join local film organizations, attend meetups, or participate in local theater productions. Often, local networks are less competitive and provide practical opportunities. If you''re in Los Angeles, organizations like Film Independent can be especially useful.

6. **Seek Mentorship:** Finding a mentor can be valuable as they can offer guidance, make introductions, and help navigate the industry. For example, reaching out to a professor who has industry connections or an experienced filmmaker for an informational interview might lead to a mentorship.

7. **Collaborate with Peers:** Your fellow newcomers are as eager to build their portfolios as you are. Collaborate on projects, support each other’s work, and grow your network organically. A collaborative short film might do well at festivals, showcasing everyone’s talent.

8. **Internships and Entry-Level Positions:** Consider internships or assistant roles, where you can observe and learn the ropes firsthand, while also making connections. Working as a production assistant can expose you to many areas of filmmaking and provide a chance to meet a variety of professionals.

9. **Follow Up and Stay in Touch:** After meeting someone, follow up with a thank-you note or email, expressing your appreciation for their time and advice. Add them on LinkedIn with a personalized message. Stay in touch by occasionally updating them on your progress or sharing interesting work you''ve done.

10. **Be Persistent and Patient:** Building a network takes time. Be persistent in your efforts, but also patient with the process. While instant successes are rare, consistent dedication to networking and improving your craft will open doors over time.

For example, consider the story of an aspiring actor who attends acting workshops, auditions regularly for roles, and volunteers at film festivals. Through these activities, they meet a local director who casts them in a small indie film. The film garners attention at festivals, and the actor’s performance is noted. Simultaneously, the actor keeps in touch with industry contacts, updating them on this success, which eventually leads to more auditions and opportunities.

In sum, treating every encounter as an opportunity to learn and connect, while consistently demonstrating professionalism, passion, and respect for others'' time, is essential for achieving the best networking outcomes in the movie industry.', 2),
  ('Creating An Impressive Portfolio', 'creating-an-impressive-portfolio', '### Introduction:

Building a portfolio is crucial for aspiring creatives in the film and TV industry. Whether you aim to be a director, screenwriter, actor, or cinematographer, a well-curated portfolio showcases your talent, skills, and unique style. In this guide, we will provide step-by-step guidance on how to create an impressive portfolio that will help you stand out in the competitive world of film and television.

**Step 1:** Define Your Focus Before diving into creating your portfolio, it''s essential to define your focus. Determine whether you want to highlight your skills as a director, screenwriter, actor, or cinematographer. This will help you curate your work accordingly and present a cohesive portfolio.

**Step 2:** Select Your Best Work Review your body of work and select the pieces that best represent your talent and style. Choose a variety of projects that demonstrate your versatility and range. Aim for quality over quantity, as a concise portfolio is more impactful.

**Step 3:** Organize Your Portfolio Decide on the format of your portfolio. It can be a physical portfolio, a website, or a digital portfolio. Ensure that the format you choose aligns with your goals and target audience. Organize your work in a logical and visually appealing manner, making it easy for viewers to navigate through your portfolio.

**Step 4:** Showcase Your Work For directors and cinematographers, include clips or stills from your projects that highlight your visual storytelling skills. Screenwriters can showcase excerpts from their scripts, while actors can include showreels or clips from their performances. Make sure the content is high-quality and represents your best work.

**Step 5:** Provide Context and Descriptions Accompany each piece in your portfolio with a brief description that provides context. Explain your role in the project, the challenges you faced, and any notable achievements. This helps potential employers or collaborators understand your creative process and the impact of your work.

**Step 6:** Highlight Achievements and Recognition Include any awards, nominations, or notable recognition you have received for your work. This adds credibility to your portfolio and demonstrates your talent and dedication.

**Step 7:** Update Regularly Keep your portfolio up to date by regularly adding new work and removing older pieces that no longer align with your current goals or style. This shows that you are actively engaged in your craft and constantly evolving as a creative professional.

**Step 8:** Seek Feedback Share your portfolio with trusted mentors, industry professionals, or peers and ask for their feedback. Constructive criticism can help you refine your portfolio and improve your chances of success.

### Conclusion:

Creating an impressive portfolio is a crucial step for aspiring creatives in the film and TV industry. By following these steps, you can curate a portfolio that showcases your talents, style, and achievements. Remember to regularly update your portfolio and seek feedback to continually improve and stay relevant in this competitive industry. Good luck on your creative journey!', 3),
  ('Starting Small In The Industry', 'starting-small-in-the-industry', '*Entry-Level Positions and Building Connections*

### Introduction:

Starting your journey in the film and TV industry at entry-level positions such as production assistants, script readers, or background acting can be a valuable steppingstone towards a successful career. These roles not only provide industry insights but also offer opportunities to build valuable professional connections. In this guide, we will provide step-by-step guidance on how to begin at entry-level positions and leverage them to kickstart your career in the film and TV industry.

**Step 1:** Research and Identify Entry-Level Positions: Start by researching and identifying entry-level positions that align with your interests and goals. Common entry-level roles include production assistants, script readers, or background acting. Understand the responsibilities and requirements of each position to determine which one suits you best.

**Step 2:** Gain Relevant Skills and Knowledge: To increase your chances of securing an entry-level position, acquire relevant skills and knowledge. Take courses, attend workshops, or engage in self-study to develop skills such as organization, communication, attention to detail, or script analysis. Familiarize yourself with industry trends, terminology, and the overall production process.

**Step 3:** Networking and Building Connections: Networking is crucial in the film and TV industry. Attend industry events, film festivals, and screenings to connect with professionals. Join online communities, forums, and social media groups related to the industry. Engage in conversations, ask questions, and seek advice. Building connections can lead to valuable opportunities and recommendations for entry-level positions.

**Step 4:** Apply for Entry-Level Positions: Prepare a well-crafted resume and cover letter tailored to each entry-level position you apply for. Highlight relevant skills, experiences, and your passion for the industry. Utilize online job boards, industry-specific websites, and social media platforms to find job postings. Consider reaching out to production companies directly to inquire about potential openings.

**Step 5:** Embrace the Role and Learn: Once you secure an entry-level position, embrace it wholeheartedly. Be proactive, reliable, and willing to learn. Take every opportunity to observe and absorb knowledge from experienced professionals. Show enthusiasm, a positive attitude, and a strong work ethic. This will help you build a good reputation and open doors for future opportunities.

**Step 6:** Expand Your Skill Set: While working in an entry-level position, look for opportunities to expand your skill set. Offer assistance in different departments, volunteer for additional tasks, or take on side projects. This will not only enhance your skills but also showcase your versatility and dedication.

**Step 7:** Seek Mentorship: Identify professionals in the industry who inspire you and seek mentorship. Reach out to them, express your admiration, and ask for guidance. A mentor can provide valuable insights, advice, and connections that can significantly impact your career growth.

**Step 8:** Stay Persistent and Patient: The film and TV industry can be highly competitive, so it''s important to stay persistent and patient. Rejection is common, but don''t let it discourage you. Keep applying for new opportunities, improving your skills, and building connections. With perseverance, dedication, and a positive mindset, you can progress towards higher-level positions.

### Conclusion:

Starting small in the film and TV industry through entry-level positions can provide you with industry insights, valuable connections, and a solid foundation for your career. By following these steps, you can increase your chances of securing entry-level roles and leverage them to propel your growth in the industry. Remember to continuously learn, network, and stay persistent. Good luck on your journey to success!', 4),
  ('Internships', 'internships', '*The Comprehensive Guide to Internships: Benefits, Drawbacks, and Finding Opportunities in the Film and TV Industry*

### Introduction:

Internships play a vital role in the film and TV industry, offering valuable hands-on experience and the opportunity to build a professional network. In this comprehensive guide, we will explore the benefits and potential drawbacks of internships, as well as provide guidance on how and where to look for internship opportunities at production companies, film studios, or on set.

### Part 1: Benefits of Internships

1.   **Hands-on Experience:** Internships provide practical, real-world experience that cannot be gained solely through academic studies. They offer the chance to work on actual projects, learn industry-specific skills, and understand the intricacies of the film and TV production process.
2.   **Professional Network:** Internships allow you to establish connections with industry professionals, including directors, producers, and fellow interns. These connections can lead to future job opportunities, mentorship, and valuable recommendations.
3.   **Industry Insights:** Internships offer a unique opportunity to gain insights into the inner workings of the film and TV industry. You can observe professionals in action, understand different roles and responsibilities, and gain a broader perspective on the industry as a whole.

### Part 2: Potential Drawbacks of Internships

1.   **Unpaid or Low-Paid Positions:** Many internships in the film and TV industry are unpaid or offer minimal compensation. This can pose financial challenges for aspiring professionals. It''s important to consider your financial situation and weigh the potential benefits against the financial drawbacks.
2.   **Long Hours and Demanding Work:** Internships in the industry often involve long hours and demanding work. You may be required to work on weekends, holidays, or in challenging conditions. It''s crucial to be prepared for the physical and mental demands of the role.
3.   **Limited Creative Control:** As an intern, you may have limited creative control over projects. Your role may primarily involve supporting the team rather than leading or making independent creative decisions. It''s important to approach the internship with a willingness to learn and contribute in any way possible.

### Part 3: Finding Internship Opportunities

1.   **Research Production Companies and Studios:** Start by researching production companies and film studios that align with your interests and goals. Visit their websites, follow their social media accounts, and stay updated on their latest projects. Many companies have dedicated internship programs or provide information on how to apply for internships.
2.   **Networking:** Networking is crucial when seeking internship opportunities. Attend industry events, film festivals, and screenings to meet professionals in the field. Join online communities, forums, and social media groups related to the film and TV industry. Engage in conversations, ask for advice, and seek recommendations for internship opportunities.
3.   **Online Job Boards and Websites:** Utilize online job boards and websites that specialize in advertising internships in the film and TV industry. Websites like EntertainmentCareers.net, InternMatch, and LinkedIn can be valuable resources for finding internship opportunities.
4.   **Cold Calling and Cold Emailing:** Consider reaching out directly to production companies, studios, or professionals in the industry. Introduce yourself, express your interest in interning, and inquire about potential opportunities. While it may require persistence and a bit of luck, cold calling or emailing can sometimes lead to hidden internship opportunities.

### Conclusion:

Internships in the film and TV industry offer numerous benefits, including hands-on experience and the chance to build a professional network. However, it''s essential to consider the potential drawbacks, such as unpaid positions and demanding work hours. By researching production companies, networking, and utilizing online resources, you can increase your chances of finding valuable internship opportunities. Remember to approach internships with enthusiasm, a willingness to learn, and a strong work ethic. Good luck on your journey to a successful career in the film and TV industry!', 5),
  ('Specialization', 'specialization', '*The Importance of Specializing in the Film and TV Industry: Becoming an International Standard Expert in Your Niche*

### Introduction:

As a new entry-level professional in the film and TV industry, gaining knowledge and experience in a particular field is just the beginning of your journey. Specializing in a specific area, such as editing, sound design, or makeup, can significantly enhance your career prospects. In this in-depth guide, we will explore the reasons why specializing and becoming an international standard expert in your niche is crucial for your professional growth in the industry.

### Part 1: Depth of Knowledge and Skill Development

1.   **Becoming a Master of Your Craft:** Specializing allows you to dive deep into your chosen field, gaining an in-depth understanding of its intricacies, techniques, and best practices. By focusing on one area, you can develop a level of expertise that sets you apart from generalists.
2.  **Continuous Skill Development:** Specializing enables you to continually refine and expand your skills within your chosen niche. As technology and industry trends evolve, it''s essential to stay updated and adapt your skills accordingly. By specializing, you can dedicate your time and energy to mastering the latest tools, techniques, and industry standards.

### Part 2: Career Advancement and Opportunities

1.   **Increased Demand and Marketability:** Specializing in a niche makes you a sought-after professional in the industry. As an international standard expert, you become a valuable asset to production companies, studios, and clients who require specialized skills. This increases your marketability and opens doors to more significant career opportunities.
2.   **Higher Earning Potential:** By becoming an international standard expert in your niche, you position yourself for higher earning potential. Specialized professionals often command higher rates due to their unique skills and expertise. Clients and employers are willing to invest more in specialists who can deliver exceptional results.

### Part 3: Building a Reputation and Professional Network

1.   **Establishing a Strong Reputation:** Specializing allows you to build a strong reputation within your niche. As you consistently deliver high-quality work and demonstrate your expertise, word-of-mouth referrals and positive recommendations will follow. A solid reputation can lead to increased visibility, credibility, and a steady stream of opportunities.
2.   **Expanding Your Professional Network:** By specializing, you become part of a niche community of professionals. Engaging with like-minded individuals, attending industry events, and participating in specialized forums or associations can help you build a strong professional network. These connections can lead to collaborations, mentorship, and access to exclusive opportunities.

### Part 4: Personal Fulfillment and Passion

1.   **Focusing on Your Passion:** Specializing in a particular field allows you to focus on what truly excites and motivates you. By pursuing your passion, you''re more likely to find fulfillment and satisfaction in your work. This enthusiasm will shine through in your projects, leading to better results and increased job satisfaction.
2.   **Personal Growth and Mastery:** Specializing provides an opportunity for personal growth and mastery. As you continue to deepen your knowledge and refine your skills, you''ll experience a sense of accomplishment and personal fulfillment. This ongoing pursuit of mastery can lead to a fulfilling and rewarding career in the film and TV industry.

### Conclusion:

Specializing in a specific area within the film and TV industry is a strategic move for new entry-level professionals. By becoming an international standard expert in your niche, you can develop a depth of knowledge, enhance your career prospects, and build a strong reputation and professional network. Embracing specialization allows you to pursue your passion, achieve personal growth, and ultimately excel in your chosen field. Remember, specialization is a journey that requires continuous learning, adaptability, and dedication. Embrace the opportunity to become a specialist and unlock the full potential of your career in the film and TV industry.', 6),
  ('Stay Current', 'stay-current', '*The importance of Staying Current in the Movie and Television Industry: A Guide to Keeping Up with the Latest News and Advancements*

**The film industry is always evolving with new technology and trends. Keep yourself updated with the latest news, methods, and technological advancements.**

### Introduction:

In today''s fast-paced world, staying current and up-to-date is crucial, especially in the dynamic and ever-evolving movie and television industry. Whether you are a newcomer or a seasoned veteran, staying informed about the latest news, methods, and technical advancements is imperative for success. This article aims to provide a comprehensive guide on how and where to source reliable information to keep yourself constantly updated and informed.

1.   **Industry Publications and Websites:** One of the best ways to stay current in the movie and television industry is by regularly following industry publications and websites. These platforms offer a wealth of information, including news articles, interviews, reviews, and analysis. Some reputable publications and websites to consider include Variety, The Hollywood Reporter, Deadline, and IndieWire. Subscribing to their newsletters or following them on social media can ensure you receive timely updates.
2.   **Trade Shows and Conferences:** Attending trade shows and conferences is an excellent way to stay abreast of the latest trends, methods, and technical advancements in the industry. Events like the Cannes Film Festival, Sundance Film Festival, and Comic-Con provide opportunities to network with industry professionals, attend panel discussions, and gain insights from experts. Additionally, these events often showcase new technologies and innovations that can shape the future of the industry.
3.   **Social Media and Online Communities:** Social media platforms such as Twitter, Instagram, and LinkedIn have become valuable sources of information for the movie and television industry. Following industry professionals, production companies, and relevant hashtags can help you stay updated on the latest news, announcements, and discussions. Additionally, joining online communities and forums dedicated to the industry can provide opportunities for networking and knowledge-sharing.
4.   **Podcasts and Webinars:** Podcasts and webinars have gained popularity as convenient and accessible sources of industry insights. Many industry professionals host podcasts where they discuss current trends, share experiences, and provide valuable advice. Webinars, on the other hand, offer the opportunity to learn from experts through online seminars and workshops. Platforms like iTunes, Spotify, and YouTube offer a wide range of industry-related podcasts and webinars.
5.   **Industry Associations and Guilds:** Joining industry associations and guilds can provide access to exclusive resources, networking events, and educational opportunities. Organizations such as the Directors Guild of America (DGA), Screen Actors Guild (SAG), and Producers Guild of America (PGA) offer memberships that come with benefits like newsletters, workshops, screenings, and industry reports. These associations often have websites and social media platforms where they share updates and news relevant to their members.

:Youtube{videoID="n8o1eKTufoQ"}

### Conclusion:

In the movie and television industry, staying current is not just a choice, but a necessity for both newcomers and veterans. By utilizing various sources such as industry publications, trade shows, social media, podcasts, and industry associations, you can keep yourself constantly updated and informed about the latest news, methods, and technical advancements. Remember, staying current is a continuous process that requires dedication and a genuine passion for the industry. So, embrace the opportunities available and stay ahead in this ever-evolving industry.', 7),
  ('Persistence And Resilience', 'persistence-and-resilience', '*The Necessity of Persistence and Resilience for Newcomers in the Film and Television Industries*

**It’s a competitive field with many rejections. Persistence is key – keep improving your skills and applying for new opportunities.**

### Introduction:

The film and television industries are known for their competitiveness, and breaking into these fields can be a challenging journey. As a newcomer, it is essential to understand the necessity of persistence and resilience. This chapter aims to highlight the importance of these qualities and provide guidance on how to cultivate them in order to navigate the industry successfully.

1.   **Embracing the Competitive Nature:** The film and television industries are highly competitive, with countless aspiring professionals vying for limited opportunities. It is crucial for newcomers to acknowledge this reality and prepare themselves mentally for the challenges ahead. Understanding that rejection is a common occurrence and that success often comes with persistence can help maintain a positive mindset.
2.   **Continuous Skill Improvement:** One way to stand out in the competitive landscape is by continuously improving your skills. Take advantage of every opportunity to learn and grow, whether through formal education, workshops, or online courses. Stay updated with the latest industry trends, techniques, and technologies. Remember, honing your craft is an ongoing process that requires dedication and a commitment to lifelong learning.
3.   **Networking and Building Relationships:** Networking plays a vital role in the film and television industries. Building connections with industry professionals, fellow newcomers, and like-minded individuals can open doors to new opportunities. Attend industry events, film festivals, and workshops to meet people and expand your network. Engage in conversations, be genuine, and maintain professional relationships. These connections can provide valuable advice, mentorship, and potential collaborations.
4.   **Embracing Rejection as a Learning Opportunity:** Rejection is an inevitable part of the journey for newcomers in the film and television industries. It is crucial to develop resilience and view rejection as a learning opportunity rather than a personal failure. Analyze feedback, learn from it, and use it to improve your skills and approach. Remember, every rejection brings you one step closer to success, as it allows you to refine your craft and better understand the industry''s expectations.
5.   **Adaptability and Flexibility:** The film and television industries are ever-evolving, and being adaptable and flexible is essential for survival. Embrace change, be open to new ideas, and be willing to take on diverse roles and projects. Being adaptable allows you to seize unexpected opportunities and navigate the industry''s dynamic nature effectively.
6.   **Celebrating Small Victories:** While persistence and resilience are necessary for long-term success, it is equally important to celebrate small victories along the way. Acknowledge and appreciate your achievements, no matter how small they may seem. Each milestone reached, whether it''s securing a small role or completing a successful project, builds confidence and motivation to keep going.

### Conclusion:

For newcomers in the film and television industries, persistence and resilience are indispensable qualities. Embrace the competitive nature of the industry, continuously improve your skills, network, and build relationships, and view rejection as a stepping stone to growth. Stay adaptable, celebrate small victories, and remember that success often comes to those who persist despite challenges. By cultivating these qualities, you can navigate the industry with determination and resilience, increasing your chances of achieving your goals in the film and television industries.', 8),
  ('Find A Mentor', 'find-a-mentor', '**Finding an Appropriate and Helpful Mentor in the Film and TV Industries**

*Seek out a mentor who can provide guidance, advice, and help navigate the complexities of the industry.*

### Introduction:

In the film and TV industries, having a mentor can be invaluable for newcomers. A mentor provides guidance, advice, and helps navigate the complexities of the business. This chapter aims to guide you on how to find an appropriate and helpful mentor and shed light on the benefits they can offer.

1.   **Clarify Your Goals and Needs:** Before seeking a mentor, it is essential to clarify your goals and needs in the film and TV industries. Determine what specific areas you require guidance and support in, such as screenwriting, directing, producing, or navigating the industry itself. Having a clear understanding of your objectives will help you find a mentor who aligns with your needs.
2.   **Research Industry Professionals:** Conduct thorough research to identify industry professionals who have achieved success in your desired field. Look for individuals whose work you admire and who have a track record of mentoring others. Utilize resources such as industry publications, social media, and networking events to gather information and insights about potential mentors.
3.   **Network and Attend Industry Events:** Networking is a powerful tool for finding a mentor. Attend industry events, film festivals, workshops, and seminars to meet professionals who may be willing to mentor newcomers. Engage in conversations, express your passion and dedication, and show genuine interest in their work. Building relationships and connections can lead to mentorship opportunities.
4.   **Approach Potential Mentors:** Once you have identified potential mentors, approach them respectfully and professionally. Craft a concise and compelling introduction that highlights your passion, goals, and admiration for their work. Explain why you believe their guidance would be valuable to your career. Be prepared for possible rejection, as not all professionals may have the capacity or willingness to take on mentoring roles.
5.   **Seek Mentorship Programs and Organizations:** Many mentorship programs and organizations exist specifically for newcomers in the film and TV industries. Research and apply to these programs, as they often match mentees with experienced professionals based on their goals and needs. These programs provide structured mentorship relationships and additional resources to support your growth.
6.   **Establish a Mentor-Mentee Relationship:** Once you have found a mentor, establish a clear understanding of expectations, boundaries, and the frequency and mode of communication. Treat the mentor-mentee relationship with respect and professionalism. Be proactive in seeking guidance, asking questions, and implementing the advice provided. Remember, the mentor''s time and expertise are valuable, so make the most of the opportunity.
7.   **Benefits of Mentorship:** A mentor can provide invaluable benefits in the film and TV industries. They offer guidance and advice based on their experience, helping you avoid common pitfalls and navigate the complexities of the business. Mentors can share industry insights, introduce you to valuable connections, and provide constructive feedback on your work. They can also offer emotional support, motivation, and encouragement during challenging times.

### Conclusion:

Finding an appropriate and helpful mentor in the film and TV industries is a valuable step towards success. By clarifying your goals, conducting research, networking, and approaching potential mentors professionally, you can find a mentor who aligns with your needs. Establishing a mentor-mentee relationship and actively seeking guidance can provide invaluable support, advice, and help in navigating the complexities of the business. Embrace the opportunity to learn from experienced professionals and leverage their expertise to accelerate your career growth in the film and TV industries. Utilize Online Platforms: Platforms like YouTube or Vimeo offer the ability to showcase your work to a wider audience. Crowdfunding sites can also help finance your projects.', 9),
  ('Utilize Online Platforms', 'utilize-online-platforms', 'In today’s digital age, online platforms have revolutionized the way newcomers in the film and TV industries can showcase their work and finance their projects. This analysis explores the benefits and strategies for utilizing platforms like YouTube, Vimeo and crowdfunding sites to reach a wider audience and secure funding for creative endeavors.

### A. Showcasing work on YouTube and Vimeo.

1.   YouTube with over 2 billion monthly active users, YouTube offers an immense opportunity for newcomers to showcase their work to a global audience. Creating a YouTube channel allows filmmakers and content creators to share trailers, short films, web series, and behind the scenes footage. By optimising titles, descriptions, and tags, newcomers can increase the discoverability of their content and attract a larger viewership.
2.   Vimeo: Known for its emphasis on high quality content, Vimeo provides a platform for filmmakers to showcase their work to a more niche and discerning audience. Vimeo’s professional features such as customisable video players, privacy settings, and analytics cater to filmmakers looking to present their work in a polished and controlled manner. Additionally, Vimeo offers a community of filmmakers and industry professionals, fostering networking opportunities and potential collaborations.

### B. Leveraging Crowdfunding Sites:

1.   Kickstarter: Kickstarter is one of the most popular crowdfunding platforms for crowdfunding platforms for creative projects, including film and TV productions. It allows newcomers to pitch their ideas, set funding goals, and offer rewards to backers. Kickstarter’s all or nothing funding model ensures that projects receive the necessary funding before moving forward. Successful examples include the “Veronica Mars” movie, which raised over $5.7 million, and the documentary “In Search of Darkness” which raised over $300,000.
2.   Indiegogo: Indiegogo is another widely used crowdfunding platform that offers flexible funding options. It allows newcomers to keep the funds raised, regardless of whether they meet their initial target. Indiegogo provides a range of campaign tools, including perks, updates and analytics to help filmmakers engage with their audience and secure funding. Notable successes on Indiegogo include the film “Blue Mountain State: The Movie” which raised over $1.9 million and the documentary “Kedi” which raised over $200,000.

### C. Strategies for Success

1.   Compelling Pitch: When utilizing online Platforms and crowdfunding sites, newcomers must create a compelling pitch that clearly communicates their project’s vision goals and unique selling points. A well-crafted pitch video or campaign page can capture the attention and interest of potential viewers and backers.
2.   Engaging with the Audience: Active engagement with the audience is crucial for success. Responding to comments, providing regular updates, and offering exclusive content to backers foster a sense of community and make supporters feel involved in the project. This engagement can lead to increased viewership, word-of-mouth promotion and ongoing support.
3.   Building a Network: Utilizing online platforms and crowdfunding sites provides opportunities to connect with like-minded individuals, industry professionals, and potential collaborators. Building a network through these platforms can lead to future partnerships, mentorship opportunities, and increased exposure for future projects.

### Conclusion:

Online Platforms like YouTube and Vimeo offer newcomers in the film and television industries the ability to showcase their work to a wider audience, while crowdfunding site like Kickstarter and Indiegogo provide a means to finance their projects. By leveraging these platforms effectively, newcomers can gain exposure, build a supportive community, and secure funding for their creative endeavors. However, success requires a compelling pitch, active engagement with the audience, and the cultivation of a network within the industry. Embracing these strategies can significantly enhance the visibility and viability of newcomers’ projects in the dynamic and competitive landscape of the film and TV industries.', 10),
  ('Market Yourself', 'market-yourself', 'Use social media and personal branding to get noticed. Engage with your potential audience and don’t be afraid to turn them into customers. Share yourself and your projects to build an online presence. Remember, in the movie business, you’re also a marketable commodity.

Although each chapter is self contained there are many crossovers - things that are recommended contained in more than one area. They’re present at various points in your personal journey and shouldn’t be ignored.

### Establish a Strong Online Presence 
Begin by creating profiles on major social media platforms such as Instagram, Twitter, Facebook, LinkedIn, and even TikTok. Your profiles should be professional and consistent with your brand. Use high-quality profile pictures and cover images that reflect your involvement in the movie industry. Write an engaging bio that highlights your skills and achievements.

### Content is King 
Regularly post content that showcases your work and personality. This can include behind-the-scenes photos, short clips of your projects, daily updates, personal insights, and more. Consistency is key; aim to post daily or several times a week to keep your audience engaged.

### Engage with Your Audience 
Interaction is crucial. Respond to comments on your posts, engage in conversations, and show appreciation for your followers. Use polls, Q&A sessions, and live videos to create a more interactive experience. The more you engage, the more likely your followers are to feel connected to you.

### Network Online 
Leverage social media to network with industry professionals. Follow directors, producers, actors, and other key players in the movie business. Comment genuinely on their posts and share their content to build relationships. Use LinkedIn to connect with professionals and join industry-related groups to stay informed and connected.

### Share Your Journey 
People love stories, so share yours. Document your journey in the movie business, from the challenges you face to your successes. This transparency not only makes you relatable but also inspires others who are on a similar path.

### Develop Your Personal Brand 
Your personal brand is what sets you apart from others. Identify what makes you unique and emphasize these qualities in your online presence. Whether it’s your unique style, work ethic, or specific expertise, highlighting these will help you stand out.

### Collaborate and Cross-Promote 
Collaborate with influencers, brands, or other creators in the industry. These partnerships can help you reach a wider audience. When you collaborate or cross-promote, always ensure it aligns with your brand.

### Leverage Analytics 
Most social media platforms provide analytics. Use these tools to understand what content performs best, which posts get the most engagement, and when your audience is most active. This data can help you refine your strategy and maximize your reach.

### Create a Personal Website 
A personal website serves as your online portfolio. Include your biography, a resume, samples of your work, testimonials, and a blog. Keep it updated with your latest projects and achievements.

### Consistency and Patience 
Building a strong online presence and personal brand takes time. Be consistent with your efforts and patient with the results. It''s a long-term investment in your career.

By strategically using social media and personal branding, you can position yourself effectively in the movie business. Engaging with your audience, showcasing your skills, and building valuable relationships will pave the way for significant opportunities.', 11),
  ('Breaking Into The Film Industry', 'breaking-into-the-film-industry', 'If your interest lies in screenwriting or directing, constantly write ideas and screenplays. Consider submitting to screenwriting competitions or script showcases. These platforms not only offer feedback but also put your work in front of industry professionals.

1.   **Network within the Industry:** New to the industry writers should attend film festivals, workshops, and industry events. Building relationships with other filmmakers, producers, and actors can lead to collaboration opportunities. Networking for writers  is crucial, as the movie business is often about who you know.
2.   **Gain Experience through Assistant Roles:** Start by taking on assistant roles in the industry. Whether it’s as a production assistant, a writer''s assistant, or even an intern, these positions provide valuable insight into the filmmaking process and help you make industry connections.
3.   **Create Your Own Content:** With advances in technology, it''s easier than ever to create your own films or web series based on your ideas or screenplays brought to life on a screen . Digital platforms like YouTube, Vimeo, and social media can be used to showcase your talent. Self-productions can grab the attention of people within the industry and lead to larger opportunities.
4.   **Understand the Business Side:** Learn the economics of the movie business. Understand how films are financed, produced, and marketed. Knowledge in these areas can make you a more well-rounded professional writer and help you better navigate the industry.
5.   **Join Professional Organizations:** Organizations such as the Writers Guild of America, Directors Guild of America, or local film commissions provide resources, networking opportunities, and support for budding filmmakers. Membership can also lend credibility to your resume.
6.   **Seek Out Mentorship:** Find experienced individuals in the industry who can offer guidance and advice to a new writer. Mentors can help navigate the complexities of the business, provide valuable feedback on your work, and share insights about their own career paths.
7.   **Keep Learning:** Continuously improve your skills by taking courses in screenwriting, directing, or other areas of filmmaking. These areas are very closely related so you need to be aware of this. Online education platforms and local community colleges offer various classes to help you refine your craft.
9.   **Stay Resilient and Persistent:** The movie business is highly competitive and often comes with setbacks. Persistence and adaptability are key. Learn from rejections, maintain a positive attitude, and keep pushing forward.

By following these steps, you can immerse yourself in the movie business and slowly but surely carve out your path to a successful career.', 12),
  ('Be Versatile', 'be-versatile', 'The more skills you have, the more job opportunities you’ll find. Don’t hesitate to explore various disciplines within the industry. Here’s a guide on how to diversify your skills and increase your chances of landing a job in the movie business:

1. **Learn Different Roles:** Understanding the different roles within a movie production can make you more valuable. From screenwriting, directing, and producing to editing, cinematography, and acting, each role contributes uniquely to the final product. Take time to learn the basics of various jobs to gain a well-rounded perspective.

2. **Develop Technical Skills:** Technical proficiency is a great asset. Familiarize yourself with industry-standard software for editing (like Adobe Premiere or Avid), visual effects (such as After Effects), and sound design (like Pro Tools). Understanding how to operate cameras, lights, and sound equipment can also be advantageous.

3. **Explore Creative Aspects:** Creativity is at the heart of filmmaking. Developing skills in writing, storyboarding, designing sets, and costume creation can open up numerous possibilities. Engage in creative projects outside the traditional scope of your desired role to broaden your experience.

4. **Network Actively:** Building a strong network is crucial. Attend film festivals, industry mixers, and workshops. Join online communities and forums where professionals share insights and opportunities. The more people you know, the more versatile your connections will be.

5. **Gain Experience in Various Genres:** Working in different genres can expand your skill set. Whether it''s drama, comedy, horror, or documentary, each genre offers unique challenges and learning opportunities. Don’t limit yourself to one style; experience as many as you can to become adaptable.

6. **Take on Different Project Sizes:** Whether it’s a big-budget feature film, an indie movie, a commercial, or a short film, working on various project sizes helps you learn different scales of production. Each type of project comes with its own set of challenges and learning experiences.

7. **Collaborate with Others:** Collaboration is key in the movie business. Work with a diverse group of people to understand different working styles and approaches. This experience will make you a better team player and open up more avenues for learning and growth.

8. **Continue Your Education:** The movie industry is constantly evolving. Stay ahead by continuing your education. Attend film school, take online courses, or participate in workshops and masterclasses. Regularly update your knowledge and skills to keep up with industry trends.

9. **Be Open to Entry-Level Positions:** Sometimes, starting from an entry-level position is the best way to get in. Roles like production assistant or intern might seem basic, but they offer a wealth of experience and networking opportunities.

10. **Build a Strong Portfolio:** A diverse portfolio showcases your versatility. Include samples of different projects you’ve worked on, highlighting various skills and roles you’ve undertaken. A strong, varied portfolio can make a significant impression on potential employers.

Being versatile means being open to learning and adapting continuously. The more adaptable and skilled you are, the more likely you are to find your niche and succeed in the competitive movie business.', 13),
  ('Join Unions And Associations', 'join-unions-and-associations', 'Consider joining relevant associations such as SAG, AFTRA, DGA or WGA in the States, or similar organizations in your own country. These organizations can provide resources, services, experiences, and further networking opportunities that are crucial for anyone looking to thrive in the movie business.

Joining a professional organization such as the Screen Actors Guild-American Federation of Television and Radio Artists (SAG-AFTRA) can offer actors essential protections and resources. SAG-AFTRA ensures fair pay, safe working conditions, and health benefits. Membership also allows access to workshops, seminars, and networking events which are ideal for skill development and career advancement. Similarly, the Directors Guild of America (DGA) provides support, advocacy, and negotiation power for directors and production staff, ensuring that their work conditions and compensation meet industry standards.

Writers aiming for established recognition and protection for their work can benefit immensely from joining the Writers Guild of America (WGA). The WGA fights for writers’ rights, fair compensation, and offers a sense of community and solidarity. Members can participate in exclusive panels, writers'' rooms, and can be part of the negotiations that shape the entertainment industry’s future.

Each of these unions and guilds not only advocates for the rights of their members but also provides a plethora of educational resources. Workshops on contract negotiations, legal rights, and career management help members navigate the complexities of the industry. Continuous learning is facilitated through various seminars and workshops conducted by experts, ensuring that members stay updated on industry trends and technological advancements.

Moreover, these organizations often host social events, festivals, and award ceremonies that are prime opportunities for networking. Mingling with industry veterans, budding artists, and other professionals can lead to collaborations, job opportunities, and mentorships. The relationships fostered within these communities are invaluable in advancing one’s career in an industry where who you know can be just as important as what you know.

For those outside the United States, most countries have their own equivalent organizations. For instance, the Broadcasting, Entertainment, Cinematograph and Theatre Union (BECTU) in the United Kingdom serves similar purposes, offering its members support, networking, and continuing educational opportunities. Similarly, the Australian Writers'' Guild (AWG) provides advocacy and support for writers across film, television, and digital platforms in Australia.

In addition to national organizations, international associations such as the International Alliance of Theatrical Stage Employees (IATSE) or the International Federation of Actors (FIA) also offer valuable resources and connections on a global scale.

In conclusion, joining a union or guild not only provides essential protections and resources but also opens doors to a network of like-minded professionals. The significance of community, continuous education, and advocacy for rights cannot be overstated. As you embark on your journey into the movie business, becoming a member of these organizations can be a pivotal step towards achieving lasting success and fulfillment in your career.', 14),
  ('Move To Industry Hubs', 'move-to-industry-hubs', 'If possible, relocate to places where the industry flourishes, like Los Angeles, London, New York, or Vancouver. These cities are not only the epicenters of production but also hubs for networking, job opportunities, and exposure to the latest industry trends. Moving to an industry hub can significantly increase your chances of breaking into the movie business for several reasons.

Firstly, these cities host major film and television studios, production companies, and numerous independent filmmakers. Being present in these locations means that you''ll have direct access to many potential employers and collaborators. It’s much easier to attend auditions, interviews, or impromptu meetings when you’re just a short drive or subway ride away.

Secondly, industry hubs offer unparalleled networking opportunities. Various film festivals, industry events, workshops, and mixers are frequently held in these cities, allowing you to meet and connect with established professionals and fellow aspirants. Relationships built during these events can lead to job offers, mentorship, and even creative partnerships. The importance of being "at the right place at the right time" cannot be overstated in an industry where personal connections often open doors.

Additionally, moving to an industry hub gives you the advantage of proximity to cutting-edge technology and resources. Post-production facilities, sound stages, studios, and equipment rental houses are abundant, making it easier to polish your projects with professional-grade materials. Furthermore, you’ll have access to experienced crew members and specialized services, enhancing the quality of any independent work you may undertake.

Living in cities like Los Angeles or New York also means immersion in a culture that lives and breathes entertainment. This can be incredibly inspirational and energizing. You’ll find yourself constantly surrounded by creative energy, which can spark ideas and drive your ambitions. Interacting with peers who share similar goals can motivate you to push boundaries and explore new avenues in your career.

Moreover, these hubs are home to a vast array of educational institutions offering courses related to filmmaking, acting, screenwriting, and various technical skills. Attending workshops or enrolling in a course can not only improve your craft but also enable you to meet like-minded individuals who might become key collaborators in the future.

Finally, many entry-level opportunities in the movie business are often filled locally. By being present in industry hubs, you can take advantage of internships, assistant roles, and other entry-level positions that are rarely advertised outside these locales. Gaining practical experience in a real-world setting, even in seemingly minor roles, can be invaluable. These positions often provide the training ground necessary for higher-level opportunities and allow you to build a resume rich with relevant experience.

Relocating to an industry hub requires significant investment in terms of time, money, and effort. However, the potential benefits of doing so can be substantial. Being in the right environment can dramatically propel your career forward, making the pursuit of success in the movie business feel more attainable.', 15),
  ('Work On Personal Projects', 'work-on-personal-projects', 'Use your initiative to create independent films or projects. This can help you experiment, enhance your skills, and gain an elevated profile quickly. Start by identifying stories or concepts you’re passionate about. This could be anything from a short film, a web series, or a documentary. Passion projects often resonate more deeply with audiences and can showcase your unique voice and style.

Begin with a short film. Short films are a fantastic way to get your feet wet in filmmaking. They require less time and money compared to feature films but still allow you to explore storytelling, directing, and editing. For example, create a 10-minute short drama focusing on a day in the life of a unique character. This not only hones your skills but also can be entered into film festivals, which can boost your recognition.

Alternatively, start a web series. Web series are episodic, allowing you to develop a story over multiple installments. This format is great for experimenting with cliffhangers, character development, and serialized storytelling. For instance, you could create a comedy series about the ups and downs of a group of friends navigating life in a big city. By uploading episodes to platforms like YouTube or Vimeo, you can slowly build an audience and attract attention from industry professionals.

Documentary projects are another excellent way to break into the industry. Documentaries can be low-budget and offer a real-world perspective that scripted films might not. Choose a subject that fascinates you, such as a local unsung hero or a unique cultural phenomenon. A well-made documentary can capture the hearts and minds of viewers and can be a powerful entry in film festivals and competitions.

Utilize available resources and networks. Partner with local actors, crew members, and locations that align with your vision. Seek out local art institutions or film co-ops that might offer grants or resources like equipment and editing facilities. For example, approach a community theater group to cast talented actors who are eager to work on film projects. This collaboration can significantly cut costs and foster a supportive creative community around your work.

Leverage social media to promote your projects. Share behind-the-scenes footage, teasers, and updates to engage potential viewers. Platforms like Instagram, Twitter, and TikTok can be powerful marketing tools that build anticipation and drive viewership for your independent project. Create an engaging social media strategy to keep your audience hooked and invested in your story.

Enter film festivals and competitions. Festivals not only provide a platform to showcase your work but also offer networking opportunities with other filmmakers, producers, and industry experts. Aim for renowned festivals such as Sundance, Cannes, or Tribeca, as well as smaller regional festivals. Winning awards or even being nominated can immensely boost your profile and open doors to future projects.

Finally, always be learning. Take advantage of online tutorials, filmmaking courses, and workshops. Platforms like MasterClass, Udemy, or local film schools can offer valuable insights into scriptwriting, cinematography, directorial techniques, and post-production. Continuous improvement and staying updated with the latest industry trends will keep your skills sharp and relevant.

By creating personal projects, you demonstrate your ability to take initiative, experiment, and produce compelling content. This proactive approach can lead to recognition, new opportunities, and ultimately, a successful career in the movie business.', 16),
  ('Stay Positive And Patient', 'stay-positive-and-patient', 'Success rarely comes overnight in the movie business. Stay positive and patient, while consistently working towards your goals. Visualization of your goals to manifest them is a very powerful first step. Imagine yourself on the red carpet, at the director’s chair, or writing the next big blockbuster. Visualizing these moments can propel your motivation and keep you focused on the journey ahead.

1. **Set Realistic Goals**: Break down your ultimate dream into smaller, attainable goals. Whether it’s writing a short script, attending film school, or working on local productions, every step counts. Celebrate these small victories to maintain morale and stay motivated.

2. **Network Relentlessly**: Forming connections within the industry is paramount. Attend film festivals, workshops, and seminars. Join online communities and social media groups dedicated to filmmaking. Building a professional network can open doors to opportunities you might have otherwise missed.

3. **Keep Learning**: The film industry is ever-evolving. Stay updated on the latest trends, technologies, and cinematic techniques. Enroll in filmmaking courses, read industry publications, or watch behind-the-scenes documentaries. Continuous learning hones your skills and shows your dedication.

4. **Create Often**: Practice makes perfect. Create short films, write scripts, or explore other areas like editing and cinematography. Every project, no matter how small, is a stepping stone. Building a portfolio showcases your talent and versatility to potential employers or collaborators.

5. **Stay Resilient**: The movie business is highly competitive, and rejection is part of the process. Learn from feedback, keep refining your craft, and never let setbacks deter you. Persistence is key to staying on top of your game and eventually succeeding.

6. **Seek Mentorship**: Finding a mentor who has navigated the industry can provide invaluable guidance. They can offer insights, advice, and connections to help you maneuver the complexities of the business. Don’t be afraid to ask for help and learn from their experiences.

7. **Adaptability is Key**: The movie industry is fluid, and being flexible can open new avenues. Be open to different roles and projects which might not directly align with your dream. These experiences can teach you new skills and provide networking opportunities.

8. **Stay Balanced**: While it’s essential to work hard, it’s equally important to maintain a work-life balance. Overworking can lead to burnout. Ensure you have time for relaxation, hobbies, and spending time with loved ones to keep your mind fresh and creative.

Remember, each day is a step closer to your dream. Stay positive, patient, and persistent. Your passion and dedication will eventually pay off, and you’ll find yourself making strides in the movie business.', 17),
  ('Movie Basic Course Intro', 'movie-basic-course-intro', '## How to get into the Movie Business: An Introduction

I offer you a concise, informative guide to help you get into the movie industry:

1. **Education and Training:** Start by studying film and media at a reputable institution, or get training through workshops and online platforms. Understanding the basics of film theory, production, scriptwriting, or acting, depending on your area of interest, is vital.

2. **Networking:** The film industry thrives on connections. Attend film festivals, workshops, and industry events to meet professionals. Consider joining online groups where you can learn from, and connect with, industry insiders.

3. **Create a Portfolio:** Whether you''re a director, screenwriter, actor, or cinematographer, a strong portfolio showcasing your best work is crucial. Short films, scripts, or demo reels can demonstrate your talent and style.

4. **Start Small:** Break into the industry through entry-level positions like production assistants, script readers, or background acting. These roles can provide industry insight and professional connections.

5. **Internships:** Look for internships at production companies, film studios, or on set. This can provide hands-on experience and build your professional network.

6. **Specialization:** Once you gain some experience, start to specialize in a particular field, such as editing, sound design, or makeup. Become an expert in your chosen niche.

7. **Stay Current:** The film industry is always evolving with new technology and trends. Keep yourself updated with the latest news, methods, and technological advancements.

8. **Persistence and Resilience:** It’s a competitive field with many rejections. Persistence is key – keep improving your skills and applying for new opportunities.

9. **Find a Mentor:** Seek out a mentor who can provide guidance, advice, and help navigate the complexities of the industry.

10. **Utilize Online Platforms:** Platforms like YouTube or Vimeo offer the ability to showcase your work to a wider audience. Crowdfunding sites can also help finance your projects.

11. **Market Yourself:** Use social media and personal branding to get noticed. Engage with your audience, share your projects, and build an online presence.

12. **Write:** If your interest lies in screenwriting or directing, consistently write scripts and ideas. Consider submitting to screenwriting competitions or script showcases.

13. **Be Versatile:** The more skills you have, the more job opportunities you’ll find. Don''t hesitate to explore various disciplines within the industry.

14. **Join Unions and Associations:** Consider joining relevant associations such as SAG-AFTRA, DGA, or WGA, which can provide resources and further networking opportunities.

15. **Move to Industry Hubs:** If possible, relocate to places where the industry is flourishing, like Los Angeles, New York, London, or Vancouver.

16. **Work on Personal Projects:** Use your initiative to create independent films or projects. This can help you experiment, enhance your skills, and gain recognition.

17. **Stay Positive and Patient:** Success rarely comes overnight. Stay positive and patient, while consistently working towards your goals.', 999),
  ('Movie Basic Congratulations', 'movie-basic-congratulations', null, 999),
  ('Movie Basic Welcome Video', 'movie-basic-welcome-video', null, 999)
) as v(title, slug, content, position)
on conflict (module_id, slug) do nothing;

with c as (
  -- The lead course (owner, 2026-09-26): its promise is the title.
  insert into courses (product_id, title, slug, description, status, level, position)
  select id, 'How to Get Your Movie Made', 'level-two',
    'From an idea to a film in production: developing the story, agents, financing, the pitch, negotiations, contracts and casting.',
    'published', 'Level Two', 10 from products where slug = 'course-level-two'
  on conflict (slug) do update set title = excluded.title, description = excluded.description, level = excluded.level, position = excluded.position returning id
), m as (
  insert into course_modules (course_id, title, description, position)
  select id, 'Level Two — Curriculum', '22 lessons.', 1 from c
  returning id
)
insert into lessons (module_id, title, slug, content, position, status)
select m.id, v.title, v.slug, v.content, v.position, 'published'
from m, (values
  ('General Advice For Creators', 'general-advice-for-creators', '
*Be Positive*

As a creator—whether you''re a writer, producer, or director—it''s crucial to maintain a positive attitude. The creative industry is unpredictable, often filled with setbacks and failures. However, your resilience and positivity will inspire others to believe in you. Embrace the mantra "Yes, you can" and turn it into "Yes, I can" to reinforce self-belief. Even renowned figures like Spielberg and Hitchcock faced difficulties yet persisted and thrived. The key to success is staying positive and persevering through challenges.

### Have a Plan

Visualizing your dreams and creating a plan is essential. Set clear, realistic goals for your projects. Convince yourself of your ambitions and make them your driving force. Knowing what you aim to achieve helps in making decisions that align with your ultimate goals. Trust your instincts, as they often guide you better than mere logic. Learn about every role in the industry to make informed decisions and avoid future regrets.

### Be Self-Aware

Understanding your personal goals and what you want from your career is crucial. Whether you''re an actor, director, or producer, it''s important to balance your aspirations with the industry''s realities. Know your strengths and weaknesses and be pragmatic in your approach. Success in the creative field requires a blend of ambition and realism. Embrace every opportunity to grow, and remember, your career is a step-by-step journey.

### Taking Criticism

Constructive criticism is valuable for improving your work, while destructive criticism should be ignored. The industry is full of critics, and sometimes negative feedback can be disheartening. Focus on feedback from trusted sources and professionals who can help you grow, and not nay-sayers who just want to belittle you.

### Work with Professionals

Hiring competent advisors, specialists, and professionals is vital. They ensure your creative projects are successful and profitable. Trustworthy legal and financial advisors can prevent you from losing earnings. Collaborate with experienced individuals who resonate with your creative vision. Evaluate their past work and ensure they align with your goals.

### Storytelling

As a creator, your role is to tell stories that captivate audiences. Every day presents an opportunity to create and share imaginative worlds through films, books, or plays. Different countries excel in various aspects of filmmaking, and globalisation has made creative collaboration more accessible. Embrace your role as a storyteller and continue to innovate and inspire.

### Don’t Give Up

Persistence is key. If you believe in your story, pursue it relentlessly. Even successful creators faced numerous rejections before their breakthroughs. For instance, Oliver Stone''s "Platoon" was initially rejected but eventually became a hit. Aim high, but plan meticulously to achieve your goals. The journey to success involves taking incremental steps towards your ultimate aspirations.

### The Meaning of Success

Success varies for everyone. For some, it''s material wealth; for others, it''s personal fulfilment. True success is the accomplishment of your goals and the positive impact your work has on others. Gauge your success by the reactions and enjoyment of your audience. Continuous success is built on achieving milestones and progressing towards your dreams.

Remember to embrace positivity, plan meticulously, be self-aware, handle criticism constructively, work with professionals, and persist in your creative endeavours. Success in the creative industry is a blend of passion, hard work, and resilience.
', 1),
  ('Developing An Idea', 'developing-an-idea', '
*Turning Your Idea into a Screenplay*

Once you have the perfect idea for a screenplay, how do you make it substantial? There are many approaches, and each person has their own preferred method.

## My Process
- **Idea Generation:** I often have ideas in my head and jot down notes to
remember them. These notes are the foundations, the spark to light the fire.

- **Treatment or Synopsis:** When ready, I write a treatment or synopsis, detailing the story, main characters, setting, period, and essential elements.

- **First Draft:** Writing the initial rough draft of the script comes easily to
me. This draft serves as a skeleton for further development.

### Screenplay to Manuscript

Most of my books start as screenplays written in present tense with lots of dialogue. Later, they are transformed into manuscripts. However, this approach has a downside: I often can''t provide producers with an outline early on.

### Developing the Story

Some writers plan out the story bit by bit, while others let the characters or plot determine the direction. I recommend creating at least a framework to maintain narrative flow.

### Documentary Approach

For documentaries, start with a passion for the subject. I''ve made documentaries about interesting people and life-changing experiences, like following The Who on tour. It begins with an idea about a person and develops from there.

### Hiring a Writer

If you’re not a writer, hire someone else. Choose a writer like you would cast an actor, ensuring they fit your film’s genre. Review writing samples for dialogue, character development, and storytelling. Make the deal simple, with initial payments and step payments as the project progresses. Always put deals in writing to avoid misunderstandings.

### Legal Representation

Finding legal help might seem impossible, but some lawyers offer special or pro bono deals for first-timers. If hiring a lawyer is out of reach, do your homework and use standard contracts available online or in books like “Contracts for the Film & Television Industry” by Mark Litwak.

### Synopsis and Outline

A synopsis or outline is crucial. It gives potential investors or collaborators a quick idea of your project without reading the entire script. Writing a synopsis, though sometimes reluctantly done, is important for presenting your project.

### Getting Your Work Read

After writing your screenplay, getting it read is a big hurdle. An agent or representative can help open doors. Research and find a good agent or lawyer to get your work in front of the right people at the right time.

### Starting Out

Starting a writing career is hard work and requires thorough planning and strategy. Build your portfolio, even if it means doing some work for free initially. Create value for yourself before expecting to be paid. Employers look for experience and what you can add to their organization, not just your degree.

### Embrace Opportunities

See barriers as opportunities. Always look for ways to push forward, especially during challenging times like the Covid pandemic. Persistence and hard work are key to turning your dream into reality.', 2),
  ('Compromising Your Creative Vision', 'compromising-your-creative-vision', '
### Listening to Your Inner Voice

When facing suggested changes to your films, remember to ask yourself: What is your inner voice telling you? Ensure that any edits still reflect your original vision and voice. If the script no longer represents you, reconsider the changes.

### Value of External Input

A professional producer or script editor can provide valuable, unbiased feedback. However, a good editor will preserve your voice and vision, as these are essential to your story.

### Balancing Input from Others

Young creative artists often face conflicting advice from managers, producers, and directors. My advice is to always focus on what you want to say and how you envision your project. Early in your career, you might need to compromise to get your show aired, but always weigh the pros and cons and trust your gut feeling.

### Defending Your Vision

Stay true to your project’s core essence. If someone suggests removing parts you deem essential, defend your vision while being open to incorporating constructive feedback without compromising the project.

### A Cautionary Tale

I once led a successful university course that was gradually altered by a new boss, resulting in a decline in quality. This taught me to always remember and stay true to the original goal of a project.

### The Reality of Selling Your Script

Once a script is sold, others often take control. This is the nature of Hollywood: the buyer may change the script to suit their needs. Choose your collaborators wisely and ensure they respect your vision.

### Working with the Right People

Establish good working relationships with those you collaborate with. If someone isn’t on your side, reconsider the partnership.

### Take Your Time

Quality over speed is crucial. Take your time with writing and rewriting to ensure each stage is the best it can be. Experience builds with every script, contributing to better work over time.

### Your Voice is Your Brand

From the beginning, hold on to your unique voice. It is your brand and the best representation of you.
', 3),
  ('Reasons For Writing', 'reasons-for-writing', '
We write because we are driven, sometimes obsessed. Why do we write film scripts? For pleasure, glory, money, showcasing creativity, sharing a vision, and making submissions. It''s not just about money but the reward of doing it and the response to our writing.

There are many types of writers, from poets to screenwriters, each with different challenges. Screenwriters are unique because, as Noel Coward said, "If it ain’t on the page, it ain’t on the stage!" Success rates for screenwriters are low, with only 5%-20% making it. Most fail because their scripts aren''t good enough by studio standards, though studios aren''t always right. Delivering a great script is hard work and requires talent.

### Six primary ways for screenwriters to get hired:

1.   Representatives pitch their script to a film company.
2.   Rewrites.
3.   Developing production company ideas.
4.   Adapting books or other original sources.
5.   Pitching original ideas.
6.   Networking.

TV writing opportunities differ but still rely on making personal contacts, attending masterclasses, obtaining fellowships, finding mentors, and continuously honing your craft. Keep writing and reading successful screenplays. Learn from rejection and become stronger.

Screenplay submissions often face long odds. Thousands of submissions might result in one acceptance. For major studios, a screenplay has a 0.3% chance of being produced. But don’t give up. Make your material stand out and follow these submission tips:

1.   Research the company.
2.   Leverage any direct connections.
3.   Attach a concise, compelling submission letter.
4.   Keep it to three paragraphs: who you are, why the company is right for your film, and a two-sentence summary.
5.   Include the intended audience.
6.   Suggest demographics if made for digital.
7.   Propose a time slot if for TV.
8.   Avoid pretending to have knowledge you don’t have.
9.   Explain why their company is ideal for your project.

Acceptance might lead to an option deal for your script, usually for a low payment to develop your material for six to twenty-four months. If it progresses, ensure your contract covers your compensation at various stages of development and production.

In my experience, we accepted about one in a hundred submissions and developed one or two out of every ten into productions. This ratio was above average for independent companies. Contracts may extend the development period for additional payments.

Writing brings pleasure, even though it starts with a blank page. Despite the solitary nature, I enjoy the physical act of writing and the structured approach of screenplays, which often serve as outlines for books. Writing fast, I produce thousands of words a day, though the thinking process takes longer.

Glory is a questionable motive. Fame brings criticism, and glory hunting can diminish the joy of writing. Money is a practical reason, but writing solely for it can be unfulfilling. True pleasure comes from sharing creative talent and vision, affecting others with your words.

The creative industries are significant, employing millions and contributing substantially to the economy. For successful submissions, find out who will read your work and tailor your approach to their preferences. Believe in yourself, keep submitting, and stay persistent. One day, your work will succeed.
', 4),
  ('Common Issues In Writing', 'common-issues-in-writing', '
*Plagiarism*

Writers often face the issue of plagiarism. For instance, a colleague and I found several of our projects had been plagiarized. It turned out that our agent, after rejecting our ideas, created similar works. To prevent such issues, protect your ideas by registering them and maintaining a clear record of who you share them with. Keep your ideas confidential until they are fully developed and secured.

### Fact Checking

Accuracy is crucial in writing to avoid liability and credibility issues. If you''re writing fiction, use your imagination but base characters on real observations, changing names and adding disclaimers. Consult a lawyer if necessary. Film companies often verify real-life events to avoid legal complications, ensuring they don’t have to withdraw works or face liability claims.

### Contracts

Verbal contracts are legally binding, but written contracts provide clearer evidence. Always have contracts signed, witnessed, and dated. While verbal agreements can work, written contracts, even if brief, are more reliable. Agents and managers can help navigate negotiations but retain financial control yourself. Lawyers can assist with larger deals to ensure the best terms.

### Writing for Various Media

Writing varies across different media like film, television, and corporate videos. Each medium has specific demands and deal structures. For example, television writers might work under showrunners, while feature film writers face stiff competition but potential high rewards. Writing for digital platforms like Netflix involves different payment structures with less chance of backend profits. Video game writing is complex due to non-linear storytelling and extensive dialogue. Corporate video writing involves clear, structured scripts that align with client needs.

### For Young Aspiring Creatives

Internships offer valuable experience but can be exploitative. Ensure terms are clear, and internships are time or project-limited. Graduates often face a long career progression, starting from lower positions. Integrating practical training with education can better prepare graduates for careers in film, corporate, advertising, or video game industries.

### Be Aware

As a writer, you might start from your own idea or be commissioned. Ensure you strike a good deal, recognizing the value of your time and effort. Avoid vague arrangements like “we’ll discuss fees later,” and secure fair compensation upfront. While it’s tempting to take on exciting projects, be cautious of schemes where you might end up underpaid despite significant contributions.

### Final Thoughts

Writing is a diverse field with various challenges and opportunities. Protect your work, verify your facts, secure your contracts, and understand the unique demands of different media. With careful planning and clear agreements, you can navigate the complexities of a writing career successfully.
', 5),
  ('The Right Role For You', 'the-right-role-for-you', '
*Know yourself - believe in your creative abilities*

Finding your place in the creative industry begins with self-belief. Recognize your creative strengths and career goals, and plan steps to achieve them. Face challenges head-on and take the initiative.

### Key Roles in the Creative Industry:

-   **Producer:** Oversees the project, arranges financing, and coordinates all aspects from writing to editing. They ensure the director has what’s needed for success.
-   **Director:** Manages the creative side, crew, and sets. Their vision brings the project to life.
-   **Writer:** Provides the original idea and script, forming the foundation of the project.

### Becoming a Successful Producer
A real producer:

1.   Is fearless.
2.   Thinks strategically and plans tactically.
3.   Defines end goals and pursues viable projects.
4.   Develops projects and assembles talent.
5.   Networks, learns from others, and celebrates their team’s talent.
6.   Motivates, leads, and makes important decisions.
7.   Handles stress and balances creativity with commercial reality.
8.   Presents and sells projects effectively.
9.   Communicates clearly and empathetically.

### Personal Insights

A producer must understand every aspect of the job without doing it all. Maintaining strong relationships with writers and directors is crucial. The role involves extensive responsibilities, including organizing material, finding talent, securing finances, and managing distribution.

### What Makes a Good Writer?

1.   Ability to write well.
2.   Good listening skills for dialogue writing.
3.   Perseverance.
4.   Imagination.
5.   Ability to work solo and collaboratively.
6.   Awareness of when to abandon a project.
7.   Sense of humour.

### What Makes a Good Director?

1.   Self-confidence.
2.   Leadership skills.
3.   Excellent communication.
4.   Vision for creative goals.
5.   Drive, energy, and stamina.
6.   Fertile imagination.
7.   Storytelling ability.

### Choosing the Right Career

Consider the entire job, not just the fun parts. Understand your stress tolerance and whether you prefer a structured organization or freelance work. Each career has its challenges and rewards, so find a balance that suits you.

### Planning Your Career

Evaluate where you are and where you want to be. Understand the politics and dynamics of your chosen field. Be prepared to reinvent yourself if necessary and seek inspiration and passion in your work.

### Compromise and Success

Success requires knowing your needs and being willing to compromise. Self-knowledge and flexibility are essential for achieving your career goals.
', 6),
  ('Career From Creativity', 'career-from-creativity', '
## Foundations of Pragmatism

*Making a Living*

As a creative entrepreneur, you need to balance your projects with making a living. Combining business acumen with your creative pursuits ensures your work is both enjoyable and profitable. It''s not about being money-obsessed, but about achieving the dream of living off your creative projects.

### The Reality

In the creative industry, technicians and craftsmen often find it easier to secure steady work compared to writers, producers, or directors. Success can bring significant rewards but also comes with risks.

### The Lesson

When I first taught at Bournemouth, a student''s concern about basic survival made me shift my focus to teaching financial and practical skills essential for sustaining a creative career. Without financial stability, creative freedom is hard to achieve.

### Balancing Finances and Creativity

Understanding and managing finances are crucial. You need the funds to execute your creative ideas. For those aiming to be their own boss, this knowledge is vital to avoid being a supplicant. After my first films, despite awards and recognition, financial challenges reminded me of the importance of balancing success and income.

### Reputation and Triple Tracking

Building a reputation requires hard work and persistence. "Triple tracking" involves managing multiple projects simultaneously, ensuring continuous progress even if some projects face delays or setbacks. Diversifying your efforts increases the chances of success.

### Patience and Flexibility

Patience is a key quality in the creative world. Always have backup plans (Plan A, B, C) and be prepared for unforeseen challenges, such as the 2020 pandemic. Logical thinking and alternative strategies are essential for overcoming obstacles and maintaining career momentum.

### Market Dynamics

Understanding market forces is essential. Smaller projects can be more profitable relative to their size, but larger projects have better odds of recouping investments due to their sheer scale. Platforms like Netflix have changed the game, offering opportunities for smaller projects to reach global audiences.

### Audience and Distribution

Know your target market and how to reach it. Cultural films may have limited international appeal, whereas aligning with market demands can broaden your audience. The American film industry, with its financial muscle, often dictates the rules. Adapting to these rules without compromising your integrity can open doors to bigger opportunities.

### Collaboration and Industry Importance

Forming alliances within the creative community strengthens your position. The creative industry significantly contributes to the economy, emphasizing the importance of combining creativity with financial savvy.

### Mixing Money and Creativity

There''s nothing wrong with mixing money and creativity. Financial success enables you to reach a wider audience and produce higher-quality work. Understanding and navigating the economic realities of the creative industry are essential for sustainable success.
', 7),
  ('Being Professional', 'being-professional', '
To thrive in a creative career, one must blend creativity with business savvy. This balance isn''t contradictory but complementary, as business efforts enhance your creative endeavours. If your goal is to make a living from your creativity, you need to handle contracts, invoices, and fees professionally.

### Being Business-like and Creative

To be business-like:
1.   Treat your creative work professionally.
2.   Prepare thoroughly, make bullet lists, stay organized, and keep appointments.
3.   Adhere to schedules and meet deadlines.

Creativity doesn''t exempt you from professionalism. Diversify your projects to spread risks and increase opportunities. Many creatives today work on multiple smaller deals rather than relying on one or two big ones. This approach is more business-like and increases your chances of sustaining a creative career.

### Pitching Your Projects

Effective pitching is crucial. Whether you''re a great speaker, a talented writer, or a dynamic performer, leverage your strengths. Adapt to virtual platforms like Zoom and Microsoft Teams if necessary and prepare meticulously. Research your audience''s preferences for proposals—written or verbal, in-person or virtual.

### Following Up

After a pitch, if you haven''t heard back, follow up politely. For instance, if your meeting was on a Monday and you haven''t received feedback by Friday, send a follow-up email the next Monday. This keeps your project on their radar and shows your professionalism.

### Document Everything

Always put agreements and communications in writing to protect yourself and maintain order. This documentation serves as proof and helps manage your professional interactions.

### Handling Rejection

Rejection is inevitable, so don''t take it personally. Learn from any constructive feedback to improve your work. If feedback isn''t relevant, understand that the rejection may simply be due to timing or preference. Maintain good relationships, leaving a positive impression even if your project is declined. This can lead to future opportunities and personal growth.

By combining business acumen with your creative skills, you can navigate the complexities of a creative career more effectively, increasing your chances of success and sustainability.
', 8),
  ('Sharing Ideas', 'sharing-ideas', '
While creativity is about talent, imagination, and passion, a financial base is essential. Creativity isn''t about money, but without it, sustaining a creative career is challenging. My philosophy is that our financial achievements are like pebbles; some of us become significant rocks like David Lean or Shakespeare, but what truly matters is the legacy we leave behind.

### Finance

Start with a business plan, even if it''s hard to predict three to five years ahead. Research and keep it simple if you can''t hire experts. Your creative project, be it a book, film, or TV show, needs a compelling idea and a well-thought-out budget aligned with a schedule. Understand the costs, and plan your cash flow meticulously.

### Ethics

Ethics are crucial. Honesty and transparency in business are non-negotiable. Respect the hard-earned money of your investors and avoid funds from unethical sources. Upholding these values is essential for a sustainable and respectable career.

### Reporting

Regular and transparent reporting is vital. It keeps everyone informed about the project''s progress, setbacks, and plans. Schedule regular updates to maintain transparency and ensure all team members are on the same page.

### Spending

Break down your budget into manageable parts and allow a small margin for error. Regularly check your spending to stay on track. Clear communication about finances within your team prevents misunderstandings and ensures everyone is aligned.

In essence, sharing ideas, philosophy, knowledge, and information is crucial for a successful creative project. Transparent communication, careful planning, and ethical practices form the backbone of a sustainable creative career.
', 9),
  ('Who Should I Work With', 'who-should-i-work-with', '
### Projects and Priorities

As a creator, you can choose your projects, whether originating them or joining existing ones. Evaluate the value of your time and decide which projects are worth it. Some projects may be too compelling to turn down, but always consider how they align with your personal and professional goals.

### Teamwork

Filmmaking is a team effort, relying on pre-publishers, distributors, marketing, and more. While the writing may be your purest contribution, compromises are often necessary. A good producer can help maintain the integrity of the project amidst various inputs.

### The Right People

Finding the right collaborators is crucial. Ensure they are competent, professional, and committed to the project''s success. Trust and mutual respect are essential for a productive working relationship. When hiring writers or other creatives, match their skills with your project''s needs and ensure they share your passion.

### Collaboration Examples

Working with a team can produce exceptional results, as seen in the making of "Get Carter." Talented individuals like Roy Budd contributed to its success. Similarly, working with directors like Roman Polanski, despite their personalities, can lead to outstanding films due to their sheer talent.

### Passion and Enthusiasm

Enthusiasm is vital. A passionate director can elevate a project significantly. For instance, on the set of "Shout at the Devil," the director''s lack of enthusiasm affected the film''s quality compared to his previous work. Passionate and committed team members drive better outcomes.

### Effective Collaboration

Chemistry with your team is crucial. Ensure everyone is on the same page and committed to the project. Address issues openly and transparently, keeping written records for future reference. Effective communication and shared goals enhance collaboration and project success.

### Preparation

Always be prepared and well-informed when dealing with investors or clients. Present complete and detailed proposals to ensure clarity and confidence in your project. Preparation and professionalism are key to securing support and achieving success.
', 10),
  ('Competition', 'competition', '
*Who Are You Competing With?*

It''s a common misconception to see others in the same industry as your competitors. While this might be true for direct roles like cameramen vying for the same gig, generally, the success of others in your field benefits you. For instance, if a network has just made a fortune with a Spielberg or Tarantino film, they are in a better position to invest in your project.

The real competition is with yourself. Continuously evaluate and improve your work. Reflect on your past efforts to identify areas for improvement.

### True Stories of Competition

On the set of "Shout at the Devil," there was palpable competition between stars Lee Marvin and Roger Moore. Their playful rivalry showcased their competitive spirits and exemplified how competition can drive better performances.

### Bettering Yourself

Always strive to do your best. Set goals and stick to them, then review and refine your work. Even if your initial effort isn''t perfect, it provides a foundation to build upon. Without a first draft, there''s nothing to improve.

When presenting a project, be thoroughly prepared with a schedule, budget, and detailed plan. Treat your creative work with the same professionalism as any other industry.

### Planning and Professionalism

Before starting a project, outline your goals, schedule, costs, and critical points. This preparation might reveal that a project is unfeasible, saving you time and resources. Making tough decisions upfront is crucial for long-term success.
', 11),
  ('Agents', 'agents', '
*The Role of an Agent*

An agent is essential for advancing your career as a filmmaker or writer. They open doors, negotiate with industry professionals, and secure deals. A good agent believes in your potential and works to generate income for both of you, making them crucial for your success.

### Why You Need an Agent

Agents do more than negotiate deals; they also generate interest in your projects, provide feedback, and offer advice. While some agents wait for offers, you need one who is proactive and believes in your potential. Top agencies might not always be the best fit, especially if you''re not a high-priority client. A boutique agency where you get personal attention might be more beneficial.

### Do You Need an Agent?

Not everyone needs an agent immediately. It''s important to build a portfolio first. Agents help move your career forward and make your projects more attractive to producers. If you manage your career well, you might delay getting an agent until you have substantial work to show.

### How to Get an Agent

When seeking an agent, find one who complements your style and whom you trust. Do thorough research to understand their preferences and history. This will help you tailor your approach and show that you are informed and serious.

### Selecting the Right Agent

Different agents specialize in various fields, so ensure you choose one that aligns with your work. Research their background, clients, and affiliations to ensure they can open the right doors for you.

### Managers: A Word of Caution

Managers help strategize your career and can be beneficial early on. However, be cautious and do thorough research before hiring one, as some might take advantage of you financially.

### Building Your Portfolio

Before approaching an agent, build a strong portfolio. Gain experience through internships or low-paying jobs in the industry. Ensure your screenplays and manuscripts are professionally edited and polished. This will make a good impression on potential agents and producers.

### Business and Fees

Agents typically take a percentage of your earnings, usually between 10-20%. As you become more established, you can negotiate this percentage. Understand that agents must balance your interests with maintaining good relationships with studios and producers.

By hiring a dedicated agent who believes in your potential, you can protect your creative work, get proper payment, and receive valuable career advice.
', 12),
  ('Financing Your Film', 'financing-your-film', '
### Raising Finance for Your Creative Projects

*Honesty is Key*

When seeking funding, always be honest about why your project is a good investment and acknowledge any past mistakes.

### Basic Methods of Raising Money
1.   **Project Description:** Briefly describe your project, focusing on its story, characters, and setting. Keep this succinct for financial presentations.
2.   **Team Credentials:** Highlight the key players—producer, director, writer, and any stars—with brief, referenced paragraphs and small photos.
3.   **Budget and Cash Flow:** Provide a total budget and a three-year cash flow plan covering development, pre-production, production, post-production, and the first year of distribution.
4.   **Projected Income:** Include projections of income over three years, covering film sales, distribution overages, TV sales, digital sales, and other income sources.

### How to Finance Your Film

1. **Genre Matters:**  The financing approach depends on the film''s genre and budget. Smaller films are easier to fund but offer lower financial returns. Follow your passion, and don''t measure success solely by financial standards.

2. **Studio Collaboration:**  Working with a studio can provide funding but may limit your creative control. A mini-studio setup with other filmmakers can enhance your chances of success.

3. **Government Funding:**  Many countries offer incentives for filmmakers. Research each country''s rules and be prepared to negotiate and compromise. In the UK, the British Film Institute (BFI) and tax relief schemes like SEIS provide support.

4.  **Pre-Sales and Co-Productions:**  Pre-sales and co-productions can reduce financial exposure. Ensure your income projections are realistic to maintain investor trust and manage expectations.

### Essential Tips
-   Be honest and realistic with yourself and investors.
-   Do thorough research on financial aspects.
-   Develop a detailed business plan with realistic, transparent figures.
-   Create a separate creative plan to engage your team.
-   Consider additional revenue streams like games or apps to diversify risk.

By following these guidelines, you can effectively raise finance for your film and increase your chances of success.
', 13),
  ('Selling Your Story', 'selling-your-story', '
*A Good Story Sells*

Defining what makes a good story can be subjective, as any genre can have great stories. It''s crucial to focus on the market and timing of your project, avoiding trends and instead creating something you are passionate about. Plan your end goals and strategies to stand out among countless other projects.

### Planning and Uniqueness

Think long-term and consider your goals. A great screenplay or novel needs more than quality; it requires a strategic plan and perfect pitching to secure the best deals. Understand the differences between big and small projects and plan accordingly.

### Future of the Creative Industries

Despite uncertainties, the creative industries will continue to thrive. The entertainment business has always adapted to technological changes and will continue to do so. Be prepared, know your business, and think globally to succeed.

### Selling Your Idea

Communication is key. Even the best creative work needs effective communication to sell. Ask vital questions to ensure the person you''re negotiating with has the authority, budget, and a solid marketing plan. Remember, terms of the deal, marketing, and sales are crucial for generating profits.

### Marketing and Distribution

Understanding and being involved in marketing and distribution is essential. Hire experts where needed but stay knowledgeable about every aspect of your project. Continuously learn and adapt to new information to ensure success.

### Continuous Learning

Always be aware of your industry''s current trends and changes. This knowledge helps you plan effectively and avoid repeating mistakes. Keep learning and hiring experts to strengthen your projects and ultimately achieve success.
', 14),
  ('The Perfect Pitch', 'the-perfect-pitch', '
### Importance of Pitching

Having a great script or idea is wonderful, but if you can''t pitch it effectively, you won''t sell it. Mastering the pitch is as crucial as developing your creative ideas. Investors often care more about financial implications than the creative content, so tailor your pitch accordingly.

### Practicing Your Pitch

Many people have ideas but lack the ability to pitch them. Without preparation, development, and a solid marketing strategy, your project won’t progress. If you’re not good at pitching, partner with someone who is. Recognize your strengths and weaknesses and play to them.

### Charisma in Pitching

When presenting to influential people, you must sell your project and yourself. Some people are naturally charismatic, but everyone can learn to pitch effectively. Know your project''s details, costs, and plan, and practice your pitch until it''s perfect.

### What Investors Want

Investors receive numerous proposals, so your pitch must stand out. Understand what the investor is looking for: potential profit, uniqueness, and contribution to the market. Be prepared to write synopses and outlines. Speak for your work confidently and answer the key question: what makes your project attractive to investors?

### Having a Plan

A good story or script isn’t enough. Have a clear vision of your project’s potential and be prepared to answer questions about its profitability and future prospects. Investors might test your flexibility, so be ready to negotiate and justify your valuation.

### Long-Term Strategies

Think beyond the immediate project. Where do you see yourself in ten years? Have multiple plans (A, B, and C) to ensure you can adapt to changes. Investors prefer diversification, so consider proposing a series of projects rather than a single one.

### Perfecting Your Pitch

Practice telling your story. Engage your audience with enthusiasm and passion. Be knowledgeable and transparent, making a strong first impression. Watching shows like "Dragons’ Den" or "Shark Tank" can provide insight into effective pitching.

### Building a Brand

Your pitch is not just about the project but also about you. Consider how you want to be perceived by the creative world and investors. Establish your brand through professionalism and by clearly conveying your vision.

### First Impressions

First impressions are critical. Present yourself as professional and knowledgeable from the moment you enter the room. This sets the tone for the entire pitch.

### Honesty and Transparency

While some exaggeration is expected, always be honest about your project’s details. Professionals will spot lies, which can damage your credibility. Being truthful helps you remember your pitch details and builds trust.

### Preparation and Expertise

Know your project inside and out and be ready to answer any questions. If you don’t know something, admit it and promise to find out. Consider consulting experts before your pitch to ensure you’re fully prepared.

By mastering these elements, you can deliver a pitch that captivates investors and sets your project on the path to success.
', 15),
  ('Understanding The Market', 'understanding-the-market', '
*The Evolving Market*

The market for creative projects is constantly changing. Streaming services like Disney+ have seen massive growth, highlighting the shift from traditional film studios to new platforms like Netflix and Apple TV. This shift offers more opportunities but also brings challenges, such as harder royalty negotiations. My advice: secure upfront payments because net-profit deals rarely pay off.

### Understanding the System

Navigating this market requires a good agent, manager, or lawyer. They have the credibility and expertise to negotiate effectively and protect you from being exploited. Building relationships with respected industry professionals is crucial for getting your foot in the door and securing good deals.

### Timing

Timing is everything. For example, the pandemic halted many productions, causing uncertainty but also presenting opportunities. Being at the right place at the right time with the right people can turn challenges into advantages.

### Competing with Studios

Studios have the resources to create high-budget projects with big names and special effects, making it challenging for smaller projects to compete. Investors will always weigh the potential returns, so it''s important to position your project strategically and highlight its unique strengths.', 16),
  ('Negotiations', 'negotiations', '
*Who to Negotiate With*

Negotiations are not about winning but creating a win-win situation. A good deal benefits both parties and aligns with common goals. Share your passion with like-minded people and ensure your team is inspired and clear on expectations.

### Doing Deals

Know your objectives and boundaries before negotiating. Determine what you are willing to sacrifice and what is non-negotiable. Understand that success requires focus and dedication.

### The Deal

Research who you are dealing with and rely on your instincts, not just expert opinions. Trust your gut and aim for a win-win situation. Think big and don''t be afraid to negotiate the best deal possible.

### Taking Risks

Creative work involves risks and isn''t for everyone. Consider your disposition and the potential stress. Understand that the potential for good money comes from taking these risks.

### Be Transparent

Build trust by being transparent and delivering on your promises. Establish a reputation for reliability and honesty. Provide evidence of your skills and financial soundness to gain trust and investment.

### Never Give Up

Persistence is key. Don''t give up if you believe in your abilities. Focus on your strengths and improve your weaknesses. Always be ready to seize opportunities.

### Become Established

Pitch to industry intermediaries, not the end-user. Align yourself with someone who can advance your project. Build credibility by being reliable and serious about your work. Credibility and a good track record are crucial for success.', 17),
  ('Contracts', 'contracts', '
*Put It in Writing*

Always document agreements to avoid misunderstandings. A written memo or contract should outline what was discussed and agreed upon. Include an arbitration clause to resolve disputes without going to court. Ensure NDAs are mutual and protect both parties'' rights.

### Drawing Up a Contract

Be specific about the services provided, deadlines, and exclusivity (first or second call). Clearly state compensation terms, including whether it’s a fixed fee or a percentage of profits. Specify the individuals involved in the agreement and their roles.

### Additional Considerations

Cover insurance details, who pays and benefits from it, and define who has business, commercial, or creative control. Outline credits, travel and expense policies, and include receipts for expenses. Use a short-form agreement with a clause for a more detailed contract later.

### Avoid Legal Issues

Aim to resolve disputes through arbitration to save time and protect reputations. Ensure the contract is based on the appropriate jurisdiction’s laws.

### Enjoy Your Work

With a solid contract in place, focus on the creative aspects of your work. Having clear agreements allows you to enjoy your creative career fully.
', 18),
  ('Making Your Movie', 'making-your-movie', '
*How to Get Your Movie Made*

Creating a film requires patience and perseverance. Understand that you’ll rely on others'' responses to your work, so expect delays and obstacles. Approach funding and negotiations as an equal, valuing your talent and creativity alongside their financial support.

## Key Elements of a Proposal

Include the following in your proposal:

-   Director and producer
-   Experience and credibility of the team
-   Film’s unique aspects and potential profitability
-   Detailed budget and profit plan
-   Reasons for investor involvement

### Story Development

Develop more than just an idea; create a comprehensive story. Use a look book to present your vision, combining facts, figures, and emotional elements. Understand that most financial details are educated guesses, with a mix of equity, debt finance, and tax concessions.

### Script and Roles

Separate the roles of writer and filmmaker. The script should be excellent regardless of budget constraints. The producer is a catalyst, while the director focuses on artistic vision. It’s challenging to combine these roles, so ideally, have a producer/writer and a director.

### Talent Agent vs. DIY

Decide if you need a talent agent to package the project or if you can manage it yourself. Agents can handle everything but will take a fee. It’s often better to attempt it independently first and seek agency help if needed.

## Finance

From the start, secure funding for living expenses and development. Minimum requirements for approaching financiers include:

1.   The script
2.   Elevator pitch
3.   One-page project summary
4.   Detailed look book
5.   Global sales forecasts
6.   Commitment letters from key talents
7.   Full information memorandum
8.   Business plan

### Professional Help

Engage accountants and lawyers for legal and regulatory compliance. Financial consultants or brokers can help raise funds but often charge a percentage and a set fee. Crowdfunding is generally not recommended for films due to marketing challenges and potential financial complications.

### Preferred Approach

Combine specialist law firm deals with finance brokers who offer reasonable advance fees and success percentages. This strategy ensures legal soundness and incentivizes brokers to secure financing.
', 19),
  ('Casting Actors', 'casting-actors', '
### How Casting Works

Casting involves selecting actors who can truly embody their roles. A star is not just famous but can make a role their own, like Sean Connery, who always maintained his Edinburgh accent yet fit every part he played.

### Is it Worth Casting a Star?

Casting a star brings value beyond their acting skills—they can promote your film. However, stars come with higher costs, including special accommodations and personal staff. Consider whether a few lesser-known actors with good chemistry might fit your film just as well.

### The Value of Chemistry

Chemistry between actors is crucial. Michael Caine and Laurence Olivier in "Sleuth" displayed how good chemistry can elevate performances, with Caine pushing Olivier to rise to his best.

### Getting the Actors

Casting has become more challenging for independent producers, who now need good representation and proof of finances to secure actors. You may need to negotiate with talent agencies or studios to put together a package. Proof of funds is essential to move forward.

### Letters of Intent

If you have a good script but no finances, secure letters of intent from actors. These letters can help convince sales agents and investors by showing that actors are interested in the project.

### Studios vs. Independent Films

Studios have the resources to cast without stars, relying on their marketing power. Independent producers need to negotiate with actors, often promising future collaborations. When choosing actors, consider their impact on sales, distribution, and marketing.

### Selecting the Right Actor

Evaluate actors not just for their fit with the role but also their motivation and interest in the project. Their enthusiasm and input can enhance their performance and contribute to the overall success of the film.
', 20),
  ('Movie Adv Welcome How To Get Your Movie Made', 'movie-adv-welcome-how-to-get-your-movie-made', null, 999),
  ('Movie Adv Congratulations', 'movie-adv-congratulations', null, 999)
) as v(title, slug, content, position)
on conflict (module_id, slug) do nothing;

-- Level Three is priced on the storefront but has no curriculum in any export,
-- so it exists as a product without lessons rather than being padded out.
-- Its title stays "Level Three" until it has a curriculum to name it by.
insert into courses (product_id, title, slug, description, status, level, position)
select id, 'Level Three', 'level-three', 'Advanced movie production and getting made.', 'draft', 'Level Three', 30
from products where slug = 'course-level-three'
on conflict (slug) do nothing;
