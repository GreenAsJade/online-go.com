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

/*
 * Test that closes all pending reports from the history page
 *
 * This test verifies that:
 * 1. A moderator can navigate to the reports history page
 * 2. Find all pending reports on the current page
 * 3. Claim each pending report
 * 4. Close each pending report
 * 5. Continue until no pending reports remain on the page
 *
 * Uses E2E_MODERATOR from init_e2e data.
 * Requires E2E_MODERATOR_PASSWORD environment variable to be set.
 */

import { Browser, TestInfo, expect } from "@playwright/test";
import { generateUniqueTestIPv6, loginAsUser, turnOffDynamicHelp } from "@helpers/user-utils";
import { expectOGSClickableByName } from "@helpers/matchers";

export const closeAllPendingReportsTest = async (
    { browser }: { browser: Browser },
    testInfo: TestInfo,
) => {
    // Set a longer timeout since we might have many reports to close
    testInfo.setTimeout(600000); // 10 minutes

    console.log("=== Close All Pending Reports Test ===");

    // Set up moderator
    const moderatorPassword = process.env.E2E_MODERATOR_PASSWORD;
    if (!moderatorPassword) {
        throw new Error("E2E_MODERATOR_PASSWORD environment variable must be set");
    }

    const uniqueIPv6 = generateUniqueTestIPv6();
    const modContext = await browser.newContext({
        extraHTTPHeaders: { "X-Forwarded-For": uniqueIPv6 },
    });
    const modPage = await modContext.newPage();

    console.log("Logging in as E2E_MODERATOR...");
    await loginAsUser(modPage, "E2E_MODERATOR", moderatorPassword);
    await turnOffDynamicHelp(modPage);
    console.log("Logged in as moderator ✓");

    // Navigate to reports history page
    console.log("Navigating to reports history page...");
    await modPage.goto("/reports-center/history");
    await modPage.waitForLoadState("networkidle");
    console.log("Reports history page loaded ✓");

    // Set page size to 50 to show more reports per page
    console.log("Setting page size to 50...");
    const pageSizeSelect = modPage.locator(".ReportsCenterHistory select");
    await expect(pageSizeSelect).toBeVisible({ timeout: 5000 });
    await pageSizeSelect.selectOption("50");

    // Wait for the loading overlay to appear and then disappear
    const loadingOverlay = modPage.locator(".PaginatedTable.loading .loading-overlay");
    await loadingOverlay.waitFor({ state: "visible", timeout: 2000 }).catch(() => {
        // Loading might be too fast to catch
    });
    await loadingOverlay.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
        // If we didn't catch it appearing, it's already hidden
    });

    // Also wait for network idle to be sure
    await modPage.waitForLoadState("networkidle");
    console.log("Page size set to 50 ✓");

    let processedCount = 0;
    let iterationCount = 0;
    const maxIterations = 100; // Safety limit to prevent infinite loops (increased since we can have more reports)

    // Process pending reports on the first page only (up to 50 reports)
    // User can run the test multiple times if there are more than 50 pending reports
    while (iterationCount < maxIterations) {
        iterationCount++;
        console.log(`\n--- Iteration ${iterationCount} ---`);

        // Wait for the table to be visible
        const historyTable = modPage.locator(".ReportsCenterHistory .history table");
        await expect(historyTable).toBeVisible({ timeout: 10000 });

        // Check for pending reports on the first page
        const pendingRows = modPage.locator("tr .state.pending");
        const pendingCount = await pendingRows.count();

        console.log(`Found ${pendingCount} pending reports visible on first page`);

        if (pendingCount === 0) {
            console.log("No more pending reports found on first page ✓");
            break;
        }

        // Get the first pending report button
        // The report button is in the same row as the pending state
        const firstPendingRow = pendingRows.first();
        const reportRow = firstPendingRow.locator("xpath=ancestor::tr");
        const reportButton = reportRow.locator("button.small").first();

        // Get the report ID for logging
        const reportButtonText = await reportButton.textContent();
        console.log(`Processing report: ${reportButtonText}`);

        // Click the report button to open the report
        await reportButton.click();
        await modPage.waitForLoadState("networkidle");
        console.log("Report opened ✓");

        // Wait for the report to load
        await modPage.waitForTimeout(1000);

        // Click the "Claim" button to claim the report
        const claimButton = await expectOGSClickableByName(modPage, /Claim/i);
        await expect(claimButton).toBeVisible({ timeout: 10000 });
        console.log("Claim button found ✓");

        await claimButton.click();
        console.log("Report claimed ✓");

        // Wait for claim to process
        await modPage.waitForTimeout(1000);

        // Now look for the "Close as good report" button
        // We'll use "Close as good report" to clear pending reports
        const closeButton = await expectOGSClickableByName(modPage, /Close as good report/i);
        await expect(closeButton).toBeVisible({ timeout: 10000 });
        console.log("Close button found ✓");

        await closeButton.click();
        console.log(`Report ${reportButtonText} closed ✓`);

        processedCount++;

        // Wait a moment for the report to be processed
        await modPage.waitForTimeout(1000);

        // Navigate back to history page
        console.log("Returning to history page...");
        await modPage.goto("/reports-center/history");
        await modPage.waitForLoadState("networkidle");
        await modPage.waitForTimeout(500);
    }

    if (iterationCount >= maxIterations) {
        console.log(
            `\n⚠️  Warning: Reached maximum iteration limit (${maxIterations}). There may be more pending reports.`,
        );
    }

    console.log(`\n=== Test Complete ===`);
    console.log(`✓ Processed ${processedCount} pending reports`);

    // Cleanup
    await modPage.close();
    await modContext.close();
};
