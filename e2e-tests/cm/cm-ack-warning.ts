/*
 * Copyright (C)  Online-Go.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// cspell:words VWNAI

// this is naughtily reusing the cm-vote-warn-not-ai test data

// it's basically the same test, we just go on to check if the warning
// pops up and can be acknowledged

/*
 * Uses init_e2e data:
 * - E2E_CM_VWNAI_ACCUSED : user supposedly used AI
 * - "E2E CM VWNAI Game" : game in which the AI use supposedly occurred
 * - E2E_CM_VWNAI_AI_V1, E2E_CM_VWNAI_AI_V2, E2E_CM_VWNAI_AI_V3 : AI assessors who vote
 */

import { Browser, TestInfo } from "@playwright/test";

import {
    goToUsersFinishedGame,
    newTestUsername,
    prepareNewUser,
    reportUser,
    setupSeededCM,
} from "@helpers/user-utils";

import { expectOGSClickableByName } from "@helpers/matchers";
import { expect } from "@playwright/test";

import { withReportCountTracking } from "@helpers/report-utils";

export const cmAckWarningTest = async ({ browser }: { browser: Browser }, testInfo: TestInfo) => {
    const { userPage: reporterPage} = await prepareNewUser(
        browser,
        newTestUsername("CmVWNAIRep"), // cspell:disable-line
        "test",
    );

    await withReportCountTracking(reporterPage, testInfo, async (tracker) => {
        // Report someone for AI use
        await goToUsersFinishedGame(reporterPage, "E2E_CM_VWNAI_ACCUSED", "E2E CM VWNAI Game");

        await reportUser(
            reporterPage,
            "E2E_CM_VWNAI_ACCUSED",
            "ai_use",
            "E2E test reporting AI use: I just have this feeling.", // min 40 chars
        );

        // Verify reporter's count increased by 1
        await tracker.assertCountIncreasedBy(reporterPage, 1);

        // Vote to warn the reporter that it was not a good AI report

        const aiAssessor = "E2E_CM_VWNAI_AI_V1";

        const { seededCMPage: aiCMPage } = await setupSeededCM(browser, aiAssessor);

        // Navigate to reports center history (newest reports at top)
        await aiCMPage.goto("/reports-center/history");
        await aiCMPage.waitForLoadState("networkidle");

        // Wait for the history table to load
        await aiCMPage.waitForTimeout(1000);

        // The newly created report should be in the first row (most recent)
        const historyTable = aiCMPage.locator(".ReportsCenterHistory table");
        await expect(historyTable).toBeVisible({ timeout: 5000 });

        const firstHistoryRow = historyTable.locator("tbody tr").first();
        await expect(firstHistoryRow).toBeVisible();

        // Click the report link/button in the first row to open it
        // The report ID is in the first column
        const reportLink = firstHistoryRow.locator("td").first().locator("a, button");
        await reportLink.click();
        await aiCMPage.waitForLoadState("networkidle");

        // Now we should see the full report with the message
        await expect(
            aiCMPage.getByText("E2E test reporting AI use: I just have this feeling."),
        ).toBeVisible();

        // Select the not-AI option...
        await aiCMPage.locator('.action-selector input[type="radio"]').nth(4).click();

        const voteButton = await expectOGSClickableByName(aiCMPage, /Vote$/);
        await voteButton.click();

        // After the AI assessor votes, the reporter should receive a warning
        // Wait a moment for the warning to be generated
        await reporterPage.waitForTimeout(3000);

        // The reporter should be warned about their crummy report
        await reporterPage.goto("/");

        await expect(reporterPage.locator("div.AccountWarning")).toBeVisible({ timeout: 15000 });

        await expect(
            reporterPage
                .locator("div.AccountWarning")
                .locator("div.canned-message.no_ai_use_bad_report"),
        ).toBeVisible();

        await reporterPage.locator("div.AccountWarning").locator("input[type='checkbox']").click();

        let okButton = reporterPage.locator("div.AccountWarning").locator("button.primary");
        await expect(okButton).toBeVisible();
        await expect(okButton).toBeDisabled();

        // Since its a warning, they should not be able to play
        await reporterPage.goto("/play");

        const playComputerButton = reporterPage.locator("button.play-button", {
            hasText: "Play Computer",
        });
        await expect(playComputerButton).toBeDisabled();

        const playHumanButton = reporterPage.locator("button.play-button", {
            hasText: "Play Human",
        });
        await expect(playHumanButton).toBeDisabled();

        // The message got reloaded when we went to /play
        await reporterPage.locator("div.AccountWarning").locator("input[type='checkbox']").click();

        okButton = reporterPage.locator("div.AccountWarning").locator("button.primary");
        await expect(okButton).toBeVisible();
        await expect(okButton).toBeDisabled();

        // wait 10 seconds before proceeding
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Now they can accept the warning
        await expect(okButton).toBeEnabled();

        await okButton.click();

        await expect(reporterPage.locator("div.AccountWarning")).not.toBeVisible();

        // And play again
        await expect(playComputerButton).toBeVisible();
        await expect(playHumanButton).toBeVisible();
        await expect(playComputerButton).toBeEnabled();
        await expect(playHumanButton).toBeEnabled();

        // After clicking OK on the warning, the count should return to initial
        await tracker.assertCountReturnedToInitial(reporterPage);
    });
};
