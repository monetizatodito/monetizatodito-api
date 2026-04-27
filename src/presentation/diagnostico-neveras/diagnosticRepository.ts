import { generarIdUnico } from "../../config/generar-id";
import { pool } from "../../db/db-config";

import { toSlug } from "../../util/slugify";

export type TipoNevera = "digital" | "analogica";

export class DiagnosticRepository {
  // Crea pregunta + tags (si vienen)
  createQuestion(
    title: string,
    defaultType: TipoNevera = "analogica",
    tags: string[] = []
  ) {
    const id = generarIdUnico();
    const baseSlug = toSlug(title);

    // opcional: garantizar slug único (descomenta si lo quieres)
    // const slug = await this.ensureUniqueSlug(baseSlug);
    const slug = baseSlug;

    const insertQ = `
      INSERT INTO diagnostic_question (id, slug, title, default_fridge_type, status)
      VALUES ($1,$2,$3,$4,'draft')
      RETURNING id, slug
    `;

    return pool.query(insertQ, [id, slug, title, defaultType]).then((qRes) => {
      if (tags.length === 0) return qRes.rows[0];

      const tagSql = `INSERT INTO tag(name) VALUES ${tags
        .map((_, i) => `($${i + 1})`)
        .join(",")}
        ON CONFLICT(name) DO NOTHING;`;

      return pool
        .query(tagSql, tags)
        .then(() =>
          pool.query("SELECT id,name FROM tag WHERE name = ANY($1);", [tags])
        )
        .then((tRes) => {
          // OJO: en tu esquema tag.id es VARCHAR(36). Si fuera INT, adapta esta línea.
          const pairs = tRes.rows.map((t: any) => `('${id}', '${t.id}')`);
          if (pairs.length === 0) return qRes.rows[0];

          const linkSql = `INSERT INTO diagnostic_question_tag(question_id, tag_id)
                           VALUES ${pairs.join(",")}
                           ON CONFLICT DO NOTHING;`;
          return pool.query(linkSql).then(() => qRes.rows[0]);
        });
    });
  }

  // Inserta/actualiza artículo por (question_id, fridge_type)
  upsertArticle(
    questionId: string,
    fridgeType: TipoNevera,
    seoTitle: string,
    seoDescription: string,
    contentMd: string,
    publish = false
  ) {
    const sql = `
      INSERT INTO diagnostic_article
      (id, question_id, fridge_type, seo_title, seo_description, content_md, published, published_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 THEN NOW() ELSE NULL END)
      ON CONFLICT (question_id, fridge_type)
      DO UPDATE SET
        seo_title=EXCLUDED.seo_title,
        seo_description=EXCLUDED.seo_description,
        content_md=EXCLUDED.content_md,
        published=EXCLUDED.published,
        published_at = CASE WHEN EXCLUDED.published THEN NOW() ELSE diagnostic_article.published_at END,
        updated_at = NOW()
      RETURNING id
    `;

    return pool
      .query(sql, [
        generarIdUnico(),
        questionId,
        fridgeType,
        seoTitle,
        seoDescription,
        contentMd,
        publish,
      ])
      .then((r) => r.rows[0]);
  }

  // FIX: article_step.id es PK VARCHAR(36) ⇒ generarlo aquí
  addStep(
    articleId: string,
    idx: number,
    title: string,
    bodyMd: string,
    tools: string[] = [],
    durationMinutes?: number,
    riskLevel: "bajo" | "medio" | "alto" = "bajo",
    mediaUrls: string[] = []
  ) {
    const stepId = generarIdUnico();
    const sql = `
      INSERT INTO article_step
      (id, article_id, idx, title, body_md, tools, duration_minutes, risk_level, media_urls)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `;

    return pool
      .query(sql, [
        stepId,
        articleId,
        idx,
        title,
        bodyMd,
        tools,
        durationMinutes ?? null,
        riskLevel,
        mediaUrls,
      ])
      .then((r) => r.rows[0]);
  }

  // Búsqueda base (sin blog mapping)
  searchQuestions(q: string, type?: TipoNevera, limit = 20) {
    const like = `%${q}%`;
    const sql = `
      SELECT id, slug, title, default_fridge_type
      FROM diagnostic_question
      WHERE (title ILIKE $1 OR similarity(title, $2) > 0.3)
      ${
        type
          ? `AND (default_fridge_type = $3
            OR EXISTS (SELECT 1 FROM diagnostic_article a
                       WHERE a.question_id = diagnostic_question.id AND a.fridge_type=$3))`
          : ""
      }
      ORDER BY
        GREATEST(similarity(title, $2), CASE WHEN title ILIKE $1 THEN 1 ELSE 0 END) DESC
      LIMIT ${limit};
    `;

    const params: any[] = [like, q];
    if (type) params.push(type);
    return pool.query(sql, params).then((r) => r.rows);
  }

  // Búsqueda + mapeo a blog por locale
  searchQuestionsWithBlog(
    q: string,
    locale: string,
    type?: TipoNevera,
    limit = 20
  ) {
    const like = `%${q}%`;
    const sql = `
      SELECT q.id, q.slug, q.title, q.default_fridge_type,
             dqp.blog_slug, COALESCE(dqp.published,false) AS blog_published
      FROM diagnostic_question q
      LEFT JOIN diagnostic_question_post dqp
             ON dqp.question_id = q.id AND dqp.locale = $3
      WHERE (q.title ILIKE $1 OR similarity(q.title, $2) > 0.3)
      ${
        type
          ? `AND (q.default_fridge_type = $4
             OR EXISTS (SELECT 1 FROM diagnostic_article a
                        WHERE a.question_id = q.id AND a.fridge_type=$4))`
          : ""
      }
      ORDER BY GREATEST(similarity(q.title, $2), CASE WHEN q.title ILIKE $1 THEN 1 ELSE 0 END) DESC
      LIMIT ${limit};
    `;
    const params: any[] = [like, q, locale];
    if (type) params.push(type);
    return pool.query(sql, params).then((r) => r.rows);
  }

  // Vincular/actualizar mapeo pregunta ↔ post del blog por idioma
  upsertQuestionBlog(
    questionId: string,
    locale: string,
    blogSlug: string,
    published = false
  ) {
    const sql = `
      INSERT INTO diagnostic_question_post (id, question_id, locale, blog_slug, published)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (question_id, locale)
      DO UPDATE SET blog_slug=EXCLUDED.blog_slug,
                    published=EXCLUDED.published,
                    updated_at=NOW()
      RETURNING question_id, locale, blog_slug, published;
    `;
    return pool
      .query(sql, [generarIdUnico(), questionId, locale, blogSlug, !!published])
      .then((r) => r.rows[0]);
  }

  // Resolver destino: prioriza blog publicado; si no, cae al slug de la pregunta
  resolveToTarget(q: string, locale: string, type?: TipoNevera) {
    return this.searchQuestionsWithBlog(q, locale, type, 1).then((rows) => {
      if (!rows.length) return null;
      const r = rows[0];
      if (r.blog_slug && r.blog_published) {
        return { kind: "blog", blogSlug: r.blog_slug };
      }
      return { kind: "question", slug: r.slug };
    });
  }

  // Obtener por slug (opcionalmente filtrando por tipo)
  getBySlug(slug: string, fridgeType?: TipoNevera) {
    const sql = `
      SELECT
        q.id as question_id, q.title, q.slug, q.default_fridge_type,
        a.id as article_id, a.fridge_type, a.seo_title, a.seo_description, a.content_md, a.published
      FROM diagnostic_question q
      LEFT JOIN diagnostic_article a
        ON a.question_id = q.id AND ($2::text IS NULL OR a.fridge_type = $2)
      WHERE q.slug = $1
    `;
    return pool.query(sql, [slug, fridgeType ?? null]).then((r) => r.rows);
  }

  // ---------- opcional: garantizar slug único ----------
  // private ensureUniqueSlug(base: string) {
  //   let slug = base;
  //   let i = 2;
  //   const exists = (s: string) =>
  //     pool
  //       .query(`SELECT 1 FROM diagnostic_question WHERE slug=$1 LIMIT 1`, [s])
  //       .then((r) => r.rowCount > 0);
  //   return (async () => {
  //     while (await exists(slug)) slug = `${base}-${i++}`;
  //     return slug;
  //   })();
  // }

  createTags(names: string[]) {
    // normaliza y quita vacíos/duplicados
    const unique = Array.from(
      new Set(names.map((n) => n.trim()).filter(Boolean))
    );
    if (unique.length === 0) return Promise.resolve([]);

    // bulk insert con ids
    const valuesSql: string[] = [];
    const params: any[] = [];
    unique.forEach((name, i) => {
      const id = generarIdUnico();
      // ($1,$2), ($3,$4) ...
      valuesSql.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
      params.push(id, name);
    });

    const insertSql = `
      INSERT INTO tag(id, name)
      VALUES ${valuesSql.join(",")}
      ON CONFLICT (name) DO NOTHING;
    `;

    return pool.query(insertSql, params).then(() => {
      // devolver los existentes/recientes por nombre
      return pool
        .query(
          `SELECT id, name FROM tag WHERE name = ANY($1) ORDER BY name ASC`,
          [unique]
        )
        .then((r) => r.rows as Array<{ id: string; name: string }>);
    });
  }

  /** Búsqueda/listado de tags (con fuzzy simple por ILIKE). */
  searchTags(q?: string, limit = 50) {
    if (!q || !q.trim()) {
      return pool
        .query(`SELECT id, name FROM tag ORDER BY name ASC LIMIT $1`, [limit])
        .then((r) => r.rows);
    }
    const like = `%${q.trim()}%`;
    return pool
      .query(
        `SELECT id, name
         FROM tag
         WHERE name ILIKE $1
         ORDER BY name ASC
         LIMIT $2`,
        [like, limit]
      )
      .then((r) => r.rows);
  }

  /** Vincula una lista de tagIds a una pregunta (ignora duplicados). */
  attachTagsToQuestion(questionId: string, tagIds: string[]) {
    const ids = Array.from(
      new Set(tagIds.map((id) => id.trim()).filter(Boolean))
    );
    if (ids.length === 0) return Promise.resolve({ inserted: 0 });

    const values = ids.map((_, i) => `($1, $${i + 2})`).join(",");
    const params = [questionId, ...ids];

    const sql = `
      INSERT INTO diagnostic_question_tag(question_id, tag_id)
      VALUES ${values}
      ON CONFLICT DO NOTHING;
    `;

    return pool.query(sql, params).then((r) => ({ inserted: r.rowCount ?? 0 }));
  }
  /** UPSERT traducción por (question_id, locale) */
  upsertQuestionTranslation(
    questionId: string,
    locale: string,
    title: string,
    slug: string
  ) {
    const sql = `
      INSERT INTO diagnostic_question_translation (id, question_id, locale, title, slug)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (question_id, locale)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        updated_at = NOW()
      RETURNING question_id, locale, title, slug
    `;
    return pool
      .query(sql, [generarIdUnico(), questionId, locale, title, slug])
      .then((r) => r.rows[0]);
  }

  /** ¿Existe traducción para (question_id, locale)? */
  existsQuestionTranslation(questionId: string, locale: string) {
    const sql = `
      SELECT 1
      FROM diagnostic_question_translation
      WHERE question_id = $1 AND locale = $2
      LIMIT 1
    `;
    return pool
      .query(sql, [questionId, locale])
      .then((r) => (r.rowCount ?? 0) > 0);
  }

  /** Búsqueda + mapeo blog *localizada* (coalesce título/slug traducidos) */
  searchQuestionsWithBlogLocalized(
    q: string,
    locale: string,
    type?: TipoNevera,
    limit = 20
  ) {
    const like = `%${q}%`;
    const sql = `
      WITH base AS (
        SELECT q.id, q.slug, q.title, q.default_fridge_type,
               GREATEST(similarity(q.title, $2), CASE WHEN q.title ILIKE $1 THEN 1 ELSE 0 END) AS rank
        FROM diagnostic_question q
        WHERE (q.title ILIKE $1 OR similarity(q.title, $2) > 0.3)
        ${
          type
            ? `AND (q.default_fridge_type = $4
                OR EXISTS (SELECT 1 FROM diagnostic_article a WHERE a.question_id = q.id AND a.fridge_type=$4))`
            : ""
        }
        ORDER BY rank DESC
        LIMIT ${limit}
      )
      SELECT
        COALESCE(t.slug, b.slug)         AS slug,
        COALESCE(t.title, b.title)       AS title,
        dqp.blog_slug,
        COALESCE(dqp.published,false)    AS blog_published
      FROM base b
      LEFT JOIN diagnostic_question_translation t
        ON t.question_id = b.id AND t.locale = $3
      LEFT JOIN diagnostic_question_post dqp
        ON dqp.question_id = b.id AND dqp.locale = $3
      ORDER BY b.rank DESC, title ASC
    `;
    const params: any[] = [like, q, locale];
    if (type) params.push(type);
    return pool.query(sql, params).then((r) => r.rows);
  }

  /** Resolver *localizado* (prefiere blog; si no, usa slug traducido si existe) */
  resolveToTargetLocalized(q: string, locale: string, type?: TipoNevera) {
    return this.searchQuestionsWithBlogLocalized(q, locale, type, 1).then(
      (rows) => {
        if (!rows.length) return null;
        const r = rows[0];
        if (r.blog_slug && r.blog_published) {
          return { kind: "blog", blogSlug: r.blog_slug };
        }
        return { kind: "question", slug: r.slug }; // ya está coalesced al slug del locale
      }
    );
  }

  /** Obtener por slug *considerando locale* (coalesce) */
  getBySlugLocalized(slug: string, locale: string, fridgeType?: TipoNevera) {
    const sql = `
      SELECT
        q.id as question_id,
        COALESCE(t.title, q.title) as title,
        COALESCE(t.slug,  q.slug)  as slug,
        q.default_fridge_type,
        a.id as article_id, a.fridge_type, a.seo_title, a.seo_description, a.content_md, a.published
      FROM diagnostic_question q
      LEFT JOIN diagnostic_question_translation t
        ON t.question_id = q.id AND t.locale = $2
      LEFT JOIN diagnostic_article a
        ON a.question_id = q.id AND ($3::text IS NULL OR a.fridge_type = $3)
      WHERE COALESCE(t.slug, q.slug) = $1
    `;
    return pool
      .query(sql, [slug, locale, fridgeType ?? null])
      .then((r) => r.rows);
  }
  listQuestionTranslations(questionId: string) {
    const sql = `
    SELECT
      q.id            as question_id,
      q.slug          as base_slug,
      q.title         as base_title,
      t.locale,
      t.slug          as t_slug,
      t.title         as t_title,
      t.updated_at
    FROM diagnostic_question q
    LEFT JOIN diagnostic_question_translation t
      ON t.question_id = q.id
    WHERE q.id = $1
    ORDER BY t.locale NULLS LAST
  `;
    return pool.query(sql, [questionId]).then((r) => r.rows);
  }
}
