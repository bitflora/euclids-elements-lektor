import { Fragment, useMemo } from "react";
import { heathHtml, joyceHtml, richHtml } from "../lib/rich";
import type { JoyceFigure } from "../types";
import { Diagram } from "./Diagram";

/** This edition's annotation prose. */
export function Rich({ md, inline, className }: { md?: string | null; inline?: boolean; className?: string }) {
  const html = useMemo(() => richHtml(md, inline), [md, inline]);
  if (!md) return null;
  const Tag = inline ? "span" : "div";
  return <Tag className={`rich ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Euclid, in Heath's words. */
export function Heath({ src, refs = "inline", as = "span" }: { src: string; refs?: "inline" | "hide"; as?: "span" | "p" | "div" }) {
  const html = useMemo(() => heathHtml(src, { refs }), [src, refs]);
  const Tag = as;
  return <Tag className="heath" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Joyce's guide, with his interactive figures mounted in place. */
export function Joyce({ md, figures }: { md?: string; figures: JoyceFigure[] }) {
  const parts = useMemo(() => {
    const html = joyceHtml(md);
    return html.split(/<div class="joyce-fig" data-fig="(\d+)"><\/div>/);
  }, [md]);
  if (!md) return null;
  return (
    <div className="rich joyce">
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: p }} />
        ) : (
          <Fragment key={i}>
            {figures[Number(p)] && (
              <div className="joyce-figure">
                <Diagram joyceConfig={figures[Number(p)].config} width={figures[Number(p)].width} height={figures[Number(p)].height} label="Joyce's figure" compact />
              </div>
            )}
          </Fragment>
        ),
      )}
    </div>
  );
}
