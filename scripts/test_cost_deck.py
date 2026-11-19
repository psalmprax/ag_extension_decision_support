#!/usr/bin/env python3
"""Automated verification tests for the Investor Monthly Operating Cost Model."""

import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

import numpy as np
from pptx import Presentation
from pypdf import PdfReader

# Dependencies come from the controlled environment only (pip install -r
# scripts/requirements-deck.txt in a virtualenv). Never prepend a shared temp
# directory to sys.path: anyone who can write there could replace an import.

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import generate_cost_deck as deck


class TestCostModelInvariants(unittest.TestCase):
    def test_totals_within_10k_to_50k_envelope(self):
        summary = deck.validate_model()
        totals = summary["totals"]
        self.assertEqual(totals, (12500, 28000, 49000))
        for total in totals:
            self.assertGreaterEqual(total, 10000)
            self.assertLessEqual(total, 50000)

    def test_category_sums_equal_phase_totals(self):
        summary = deck.compute_summary()
        cat_totals = summary["cat_totals"]
        for idx in range(3):
            col_sum = sum(cat_totals[c][idx] for c in deck.CATEGORY_ORDER)
            self.assertEqual(col_sum, summary["totals"][idx])

    def test_cogs_plus_fixed_equals_totals(self):
        summary = deck.compute_summary()
        for idx in range(3):
            self.assertEqual(
                summary["cogs"][idx] + summary["fixed"][idx],
                summary["totals"][idx],
            )

    def test_all_requested_domains_present(self):
        cats = set(deck.CATEGORY_ORDER)
        self.assertIn("1. Human Resources", cats)
        self.assertIn("2. Core Infrastructure & DevSecOps", cats)
        self.assertIn("3. AI Power & Trained Custom AI", cats)
        self.assertIn("4. Telecom, Satellite & Field Delivery", cats)
        self.assertIn("5. Compliance, Risk, G&A & Contingency", cats)

    def test_twelve_month_ramp_exact(self):
        self.assertEqual(len(deck.TWELVE_MONTH_RAMP), 12)
        self.assertEqual(sum(m[1] for m in deck.TWELVE_MONTH_RAMP), 305500)
        for _, burn, _ in deck.TWELVE_MONTH_RAMP:
            self.assertGreaterEqual(burn, 10000)
            self.assertLessEqual(burn, 50000)

    def test_hr_ftes_sum_exactly(self):
        summary = deck.compute_summary()
        self.assertEqual(
            summary["hr_ftes"],
            (Decimal("3.00"), Decimal("6.05"), Decimal("10.25")),
        )

    def test_gross_margins_round_half_up(self):
        summary = deck.compute_summary()
        self.assertEqual(
            summary["margins_150"],
            (Decimal("60.0"), Decimal("85.3"), Decimal("93.3")),
        )
        self.assertEqual(
            summary["margins_200"],
            (Decimal("70.0"), Decimal("89.0"), Decimal("94.9")),
        )

    def test_breakeven_curve_intersections(self):
        summary = deck.compute_summary()
        specs = deck.build_chart_specs(summary)
        farmers_k = specs["farmers_k"]
        opex_curve = specs["opex_curve"]
        rev_target = specs["rev_target"]
        rev_conserv = specs["rev_conserv"]

        # Exact crossings on the $28,000 Phase 2 plateau
        be_200 = specs["be_x_200"]
        be_150 = specs["be_x_150"]
        self.assertAlmostEqual(be_200, 14.0, places=2)
        self.assertAlmostEqual(be_150, 18.67, places=2)
        self.assertAlmostEqual(
            float(np.interp(be_200, farmers_k, rev_target)),
            float(np.interp(be_200, farmers_k, opex_curve)),
            delta=1.0,
        )
        self.assertAlmostEqual(
            float(np.interp(be_150, farmers_k, rev_conserv)),
            float(np.interp(be_150, farmers_k, opex_curve)),
            delta=10.0,
        )
        arrow_x, arrow_y = specs["be_arrow_xy"]
        self.assertAlmostEqual(
            arrow_y * 1000.0,
            float(np.interp(arrow_x, farmers_k, opex_curve)),
            delta=1.0,
        )

    def test_chart_specs_and_ramp_legend(self):
        summary = deck.compute_summary()
        specs = deck.build_chart_specs(summary)
        self.assertEqual(
            specs["ai_savings_pcts"],
            (Decimal("69.0"), Decimal("70.8"), Decimal("73.6")),
        )
        self.assertEqual(specs["ai_savings_range_lbl"], "69–74%")
        self.assertEqual(specs["ramp_ylim"], (0, 70000))
        legend_stages = [k for k, _ in specs["ramp_legend_specs"]]
        self.assertEqual(legend_stages, ["Pilot", "Growth", "Scale Ramp", "Scale"])
        self.assertEqual(specs["ramp_stage_colors"]["Scale"], "#14532D")


def slide_texts(pptx_path: Path) -> list:
    """Every text frame and table cell, slide by slide: the deck's content."""
    texts = []
    for slide in Presentation(str(pptx_path)).slides:
        parts = []
        for shp in slide.shapes:
            if shp.has_text_frame:
                parts.append(shp.text_frame.text)
            if getattr(shp, "has_table", False) and shp.has_table:
                parts.extend(cell.text for row in shp.table.rows for cell in row.cells)
        texts.append(parts)
    return texts


class TestGeneratedArtifacts(unittest.TestCase):
    """Builds the deck from the current generator into a private temporary directory
    (the enforced prerequisite), checks that output, then checks the committed deck
    in docs/ still matches it. File timestamps are not used: git does not keep them."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory(prefix="ag_cost_deck_test_")
        cls.pptx, cls.pdf = deck.generate_deck(Path(cls._tmp.name))

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_pptx_exists_and_has_12_slides(self):
        self.assertTrue(self.pptx.is_file(), f"Missing {self.pptx}")
        prs = Presentation(str(self.pptx))
        self.assertEqual(len(prs.slides), 12)

    def test_pptx_shapes_have_no_drop_shadows(self):
        prs = Presentation(str(self.pptx))
        for s_idx, slide in enumerate(prs.slides, start=1):
            for shp in slide.shapes:
                sp_pr = getattr(shp._element, "spPr", None)
                if sp_pr is not None:
                    effect_lsts = [c for c in sp_pr if c.tag.endswith("effectLst")]
                    self.assertTrue(
                        len(effect_lsts) >= 1,
                        f"Slide {s_idx} shape '{shp.name}' missing empty effectLst",
                    )
                    for el in effect_lsts:
                        self.assertEqual(
                            len(list(el)),
                            0,
                            f"Slide {s_idx} shape '{shp.name}' still contains shadow/effect children",
                        )
                for child in shp._element:
                    if child.tag.endswith("style"):
                        for sub in child:
                            if sub.tag.endswith("effectRef"):
                                self.assertEqual(
                                    sub.get("idx"),
                                    "0",
                                    f"Slide {s_idx} shape '{shp.name}' has non-zero effectRef idx",
                                )

    def test_committed_deck_matches_generator(self):
        for committed in (deck.OUT_PPTX, deck.OUT_PDF):
            self.assertTrue(committed.is_file(), f"Missing {committed}; run scripts/generate_cost_deck.py")
        self.assertEqual(
            slide_texts(deck.OUT_PPTX),
            slide_texts(self.pptx),
            "docs/ deck is stale: run scripts/generate_cost_deck.py and commit the result",
        )
        committed_pages = len(PdfReader(str(deck.OUT_PDF)).pages)
        self.assertEqual(committed_pages, len(PdfReader(str(self.pdf)).pages))

    def test_hr_slide_figures_come_from_the_ledger(self):
        hr_text = " ".join(slide_texts(self.pptx)[3])
        self.assertIn("$2.5k–$2.8k per FTE blended across the team", hr_text)
        self.assertIn("platform and AI/ML engineers $3.8k–$4.8k", hr_text)
        self.assertIn("does not cover the $7,400/mo HR cost", hr_text)
        self.assertNotIn("without outgrowing pilot revenue", hr_text)

    def test_source_chart_formatting_uses_commas(self):
        src = Path(deck.__file__).read_text(encoding="utf-8")
        self.assertIn('f"${int(gpu_train[i]):,}"', src)
        self.assertIn('f"${int(labeling[i]):,}"', src)

    def test_pdf_exists_and_contains_key_figures(self):
        self.assertTrue(self.pdf.is_file(), f"Missing {self.pdf}")
        reader = PdfReader(str(self.pdf))
        self.assertEqual(len(reader.pages), 12)
        full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        for expected in [
            "$12,500",
            "$28,000",
            "$49,000",
            "$305,500",
            "3.00 FTE",
            "94.9%",
            "93.3%",
            "$0.083",
            "69–74%",
            "WHATSAPP_TEMPLATE_SIDS",
            "Postgres 15",
            "ONNX_MIN_PROBABILITY",
            "OmniRoute",
            "YOLOv8n",
            "MobileViT",
            "Sentinel Hub",
            "OCAP",
            "EUDR",
        ]:
            self.assertIn(expected, full_text, f"Expected '{expected}' in PDF text")

        for forbidden in [
            "2.95 FTE",
            "95.0%",
            "Postgres 16",
            "Meta WhatsApp Cloud API",
            "~70-74%",
        ]:
            self.assertNotIn(forbidden, full_text, f"Stale/incorrect '{forbidden}' found in PDF text")


if __name__ == "__main__":
    unittest.main(verbosity=2)
