-- 一枚ごとの「リンクで公開」。書いた本人が入れている間だけ、URL を知っている人なら誰でも本文だけ読める。
-- 列を一つ足すだけ。既存の一枚はすべて閉じたまま（false）。
ALTER TABLE "Slip" ADD COLUMN "open" BOOLEAN NOT NULL DEFAULT false;
