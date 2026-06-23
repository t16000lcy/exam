from __future__ import annotations

import argparse
import json
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from generate_ai_tutor_cache import template_for
from normalize_questions import infer_topic, load_json, write_json


SUBJECTS = {
    "clinical-physiology-pathology": "臨床生理學與病理學",
    "hematology-blood-bank": "臨床血液學與血庫學",
    "molecular-microscopy-parasitology": "醫學分子檢驗學與臨床鏡檢學（包括寄生蟲學）",
    "microbiology-clinical-microbiology": "微生物學與臨床微生物學（包括細菌與黴菌）",
    "biochemistry-clinical-biochemistry": "生物化學與臨床生化學",
    "serology-immunology-virology": "臨床血清免疫學與臨床病毒學",
}

PHASES = {
    "phase1": {
        "label": "Phase 1",
        "description": "115 年第一次「醫學分子檢驗學與臨床鏡檢學（包括寄生蟲學）」",
        "years": {"115"},
        "exam_codes": {"1"},
        "subject_slugs": {"molecular-microscopy-parasitology"},
    },
    "phase2": {
        "label": "Phase 2",
        "description": "115 年全部六科",
        "years": {"115"},
        "exam_codes": {"1"},
        "subject_slugs": set(SUBJECTS),
    },
    "phase3": {
        "label": "Phase 3",
        "description": "110–115 年全部題目",
        "years": {"110", "111", "112", "113", "114", "115"},
        "exam_codes": {"1", "2"},
        "subject_slugs": set(SUBJECTS),
    },
}


def load_source_questions(source_dir: Path) -> dict[str, list[dict]]:
    return {slug: load_json(source_dir / f"{slug}.json", []) for slug in SUBJECTS}


def select_questions(source: dict[str, list[dict]], phase: dict) -> dict[str, list[dict]]:
    selected: dict[str, list[dict]] = {}
    for slug in SUBJECTS:
        if slug not in phase["subject_slugs"]:
            selected[slug] = []
            continue
        selected[slug] = [
            question
            for question in source.get(slug, [])
            if str(question.get("year")) in phase["years"] and str(question.get("exam_code")) in phase["exam_codes"]
        ]
    return selected


def validate(selected: dict[str, list[dict]], rules: list[dict]) -> tuple[dict, list[dict], list[dict], list[dict]]:
    issues: list[dict] = []
    image_questions: list[dict] = []
    missing_answers: list[dict] = []
    manual_review: list[dict] = []
    seen_ids: set[str] = set()

    for slug, questions in selected.items():
        for question in questions:
            question_id = question.get("id") or question.get("question_id", "")
            if question_id in seen_ids:
                issues.append({"type": "duplicate_question_id", "question_id": question_id})
                manual_review.append({"reason": "duplicate_question_id", "question_id": question_id})
            seen_ids.add(question_id)

            labels = {option.get("label") for option in question.get("options", [])}
            if labels != {"A", "B", "C", "D"}:
                item = {"type": "missing_options", "question_id": question_id, "labels": sorted(labels)}
                issues.append(item)
                manual_review.append({"reason": "missing_options", **item})

            answer_type = question.get("answer_type")
            answers = question.get("answer") or []
            if answer_type != "all_credit" and not answers:
                item = {"question_id": question_id, "year": question.get("year"), "question_number": question.get("question_number")}
                missing_answers.append(item)
                manual_review.append({"reason": "missing_answer", **item})
            if answer_type == "all_credit":
                pass
            elif any(answer not in {"A", "B", "C", "D"} for answer in answers):
                issues.append({"type": "invalid_answer", "question_id": question_id, "answer": answers})

            if question.get("has_image") or question.get("requires_image") or question.get("image_paths"):
                image_questions.append(
                    {
                        "question_id": question_id,
                        "year": question.get("year"),
                        "exam_code": question.get("exam_code"),
                        "subject": question.get("subject"),
                        "question_number": question.get("question_number"),
                        "image_paths": question.get("image_paths", []),
                    }
                )

            if infer_topic(question, rules) == "待分類":
                manual_review.append(
                    {
                        "reason": "topic_pending",
                        "question_id": question_id,
                        "year": question.get("year"),
                        "question_number": question.get("question_number"),
                    }
                )

    report = {
        "ok": not issues and not missing_answers,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_questions": sum(len(items) for items in selected.values()),
        "issues": issues,
        "missing_answer_count": len(missing_answers),
        "image_question_count": len(image_questions),
        "manual_review_count": len(manual_review),
    }
    return report, image_questions, missing_answers, manual_review


def build_cache(selected: dict[str, list[dict]], rules: list[dict]) -> dict:
    cache = {}
    for questions in selected.values():
        for question in questions:
            question_id = question.get("id") or question.get("question_id", "")
            if not question_id:
                continue
            cache[question_id] = template_for(question, infer_topic(question, rules))
    return cache


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=PHASES, default="phase1")
    parser.add_argument("--source-dir", default="data/full_questions")
    parser.add_argument("--site-dir", default="data/questions")
    parser.add_argument("--reports-dir", default="")
    args = parser.parse_args()

    phase = PHASES[args.phase]
    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        source_dir = Path("data/questions")
    site_dir = Path(args.site_dir)
    rules = load_json(Path("data/topic_rules.json"), [])
    selected = select_questions(load_source_questions(source_dir), phase)

    site_dir.mkdir(parents=True, exist_ok=True)
    for slug, questions in selected.items():
        write_json(site_dir / f"{slug}.json", questions)

    subject_counts = {slug: len(questions) for slug, questions in selected.items()}
    total = sum(subject_counts.values())
    parse_report = {
        "phase": args.phase,
        "phase_label": phase["label"],
        "description": phase["description"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "success_question_count": total,
        "failed_question_count": 0,
        "subject_counts": subject_counts,
    }
    validation_report, image_questions, missing_answers, manual_review = validate(selected, rules)
    question_stats = {
        "phase": args.phase,
        "description": phase["description"],
        "total_questions": total,
        "subject_counts": subject_counts,
        "year_counts": dict(Counter(question.get("year", "") for questions in selected.values() for question in questions)),
        "exam_code_counts": dict(Counter(question.get("exam_code", "") for questions in selected.values() for question in questions)),
    }

    manifest = {
        "phase": args.phase,
        "phase_label": phase["label"],
        "description": phase["description"],
        "range_text": phase["description"],
        "total_questions": total,
        "subject_counts": subject_counts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    write_json(Path("data/question_manifest.json"), manifest)
    write_json(Path("data/parse_report.json"), {**parse_report, "image_question_count": len(image_questions), "missing_answer_count": len(missing_answers), "manual_review_count": len(manual_review)})
    write_json(Path("data/validation_report.json"), validation_report)
    write_json(Path("data/question_stats.json"), question_stats)
    write_json(Path("data/image_questions.json"), image_questions)
    write_json(Path("data/missing_answers.json"), missing_answers)
    write_json(Path("data/manual_review_questions.json"), manual_review)
    write_json(Path("data/ai_tutor_cache.json"), build_cache(selected, rules))

    reports_dir = Path(args.reports_dir or f"data/phases/{args.phase}/reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    for filename in [
        "parse_report.json",
        "validation_report.json",
        "question_stats.json",
        "image_questions.json",
        "missing_answers.json",
        "manual_review_questions.json",
    ]:
        shutil.copyfile(Path("data") / filename, reports_dir / filename)
    print(f"{phase['label']} generated: {total} questions")
    print(f"reports -> {reports_dir}")
    return 0 if validation_report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
