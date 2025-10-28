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

/*
 * Uses init_e2e data:
 * - E2E_CM_VWNAI_ACCUSED : user supposedly used AI
 * - "E2E CM VWNAI Game" : game in which the AI use supposedly occurred
 * - E2E_CM_VWNAI_AI_V1: AI assessor who votes
 */

import { Browser, TestInfo } from "@playwright/test";

import {
    captureReportNumber,
    goToUsersFinishedGame,
    navigateToReport,
    newTestUsername,
    prepareNewUser,
    reportUser,
    setupSeededCM,
} from "@helpers/user-utils";

import { expectOGSClickableByName } from "@helpers/matchers";
import { expect } from "@playwright/test";

import { withReportCountTracking } from "@helpers/report-utils";

export const cmVoteWarnNotAITest = async (
    { browser }: { browser: Browser },
    testInfo: TestInfo,
) => {
    const { userPage: reporterPage } = await prepareNewUser(
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

        // Capture the report number from the reporter's "My Own Reports" page
        const reportNumber = await captureReportNumber(reporterPage);

        // Vote to warn the reporter that it was not a good AI report

        const aiAssessor = "E2E_CM_VWNAI_AI_V1";

        const { seededCMPage: aiCMPage } = await setupSeededCM(browser, aiAssessor);

        // Navigate directly to the report using the captured report number
        await navigateToReport(aiCMPage, reportNumber);

        // Verify we can see the report with the message
        await expect(
            aiCMPage.getByText("E2E test reporting AI use: I just have this feeling."),
        ).toBeVisible();

        // Select the not-AI option...
        await aiCMPage.locator('.action-selector input[type="radio"]').nth(3).click();

        const voteButton = await expectOGSClickableByName(aiCMPage, /Vote$/);
        await voteButton.click();

        // After voting, the count should return to initial (warning delivered to reporter)
        await tracker.assertCountReturnedToInitial(reporterPage);

        // checking the warning is delivered is in cm-ack-warning.ts
    });
};
