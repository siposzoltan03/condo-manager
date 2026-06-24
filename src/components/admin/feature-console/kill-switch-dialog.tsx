"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Power } from "lucide-react";
import { makeCx } from "./cx";
import styles from "./feature-console.module.css";

const cx = makeCx(styles);

export function KillSwitchDialog({
  slug,
  name,
  affected,
  onCancel,
  onConfirm,
}: {
  slug: string;
  name: string;
  affected: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("featureConsole.kill");
  const [value, setValue] = useState("");
  const armed = value.trim().toUpperCase() === "KILL";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className={cx("console", "overlay")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className={cx("dialog")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kill-title"
      >
        <div className={cx("dl-top")} />
        <div className={cx("dl-head")}>
          <div className={cx("dl-icon")}>
            <Power />
          </div>
          <div>
            <div className={cx("lbl")}>{t("label")}</div>
            <h2 id="kill-title">{t("title", { name })}</h2>
          </div>
        </div>
        <div className={cx("dl-body")}>
          <p>
            {t.rich("body", {
              name,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
          <div className={cx("impact")}>
            <div className={cx("ir")}>
              <span className={cx("l")}>{t("affected")}</span>
              <span className={cx("v", "big")}>
                {t("affectedValue", { count: affected })}
              </span>
            </div>
            <div className={cx("ir")}>
              <span className={cx("l")}>{t("planOverride")}</span>
              <span className={cx("v")}>{t("ignored")}</span>
            </div>
            <div className={cx("ir")}>
              <span className={cx("l")}>{t("reenable")}</span>
              <span className={cx("v")}>{t("immediate")}</span>
            </div>
          </div>
          <div className={cx("dl-confirm")}>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t("confirmPlaceholder")}
              aria-label={t("confirmAria")}
              autoFocus
            />
          </div>
        </div>
        <div className={cx("dl-foot")}>
          <button className={cx("btn", "btn-ghost")} onClick={onCancel}>
            {t("cancel")}
          </button>
          <button className={cx("btn", "btn-danger")} disabled={!armed} onClick={onConfirm}>
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
