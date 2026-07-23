import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { getSpecializedLesson, getWatchedLessons, markLessonAsWatched } from "@/lib/specialized-course-detail-data";
import { useLocale, useT } from "@/i18n/locale";

export default function PanelSpecializedCourseLessonPage() {
  const { isAdmin, isBarber } = useAuth();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const [match, params] = useRoute("/panel/specialized-courses/:courseId/lessons/:lessonId");
  const [marked, setMarked] = useState(false);

  const lessonData = useMemo(() => {
    if (!match) {
      return { course: null, chapter: null, lesson: null };
    }

    return getSpecializedLesson(params.courseId, params.lessonId);
  }, [match, params?.courseId, params?.lessonId]);

  const alreadyWatched = useMemo(() => {
    if (!lessonData.course || !lessonData.lesson) {
      return false;
    }

    return getWatchedLessons(lessonData.course.id).includes(lessonData.lesson.id);
  }, [lessonData]);

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 flex items-center justify-center" dir={dir}>
        <div className="max-w-md w-full text-center space-y-4">
          <Lock className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">{t("specializedCourseLesson.accessDeniedTitle")}</h1>
          <Link href="/panel/specialized-courses">
            <Button>{t("specializedCourseLesson.back")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!lessonData.course || !lessonData.lesson) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground text-start" dir={dir}>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm text-primary">{lessonData.course.title}</div>
            <h1 className="text-xl font-black">{lessonData.lesson.title}</h1>
          </div>
          <Link href={`/panel/specialized-courses/${lessonData.course.id}`}>
            <Button variant="outline" size="icon" title={t("specializedCourseLesson.back")} className="h-11 w-11 rounded-2xl border-border bg-background/50">
              <ArrowRight className={`h-5 w-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Card className="overflow-hidden rounded-[32px] border-border/70 bg-card/60">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {lessonData.lesson.isFree ? (
                <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">{t("specializedCourseLesson.freeBadge")}</Badge>
              ) : (
                <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-300">{t("specializedCourseLesson.lockedBadge")}</Badge>
              )}
              <Badge variant="outline" className="border-border/70 bg-background/60 text-muted-foreground">{lessonData.chapter?.title}</Badge>
              {alreadyWatched || marked ? (
                <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">{t("specializedCourseLesson.watchedBadge")}</Badge>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-black">
              <video
                src={lessonData.lesson.videoUrl}
                controls
                playsInline
                className="max-h-[72vh] w-full object-contain"
                poster={lessonData.course.heroImage}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PlayCircle className="h-4 w-4 text-primary" />
                {t("specializedCourseLesson.markHint")}
              </div>
              <Button
                className="rounded-[20px] px-6"
                onClick={() => {
                  markLessonAsWatched(lessonData.course!.id, lessonData.lesson!.id);
                  setMarked(true);
                }}
              >
                <CheckCircle2 className="me-2 h-4 w-4" />
                {t("specializedCourseLesson.markWatched")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
