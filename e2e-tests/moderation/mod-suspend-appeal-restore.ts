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
 * Test the complete suspend-appeal-restore flow
 *
 * This test verifies that:
 * 1. A moderator can suspend a user account
 * 2. The suspended user sees the suspension banner with appeal link
 * 3. The user can submit an appeal message
 * 4. The moderator can view the appeal in the Appeals Centre
 * 5. The moderator can respond while leaving the user suspended
 * 6. The user can see the moderator's response and reply
 * 7. The moderator can restore the account using the new "Restore Account" button
 * 8. The user no longer sees the suspension banner after restoration
 * 9. [TODO] The user receives a system PM with the final message
 *
 * Uses E2E_MODERATOR from init_e2e data for moderator functionality.
 * Requires E2E_MODERATOR_PASSWORD environment variable to be set.
 */

import { Browser, expect } from "@playwright/test";
import {
    newTestUsername,
    prepareNewUser,
    generateUniqueTestIPv6,
    loginAsUser,
    turnOffDynamicHelp,
    goToUsersProfile,
} from "../helpers/user-utils";
import { expectOGSClickableByName } from "../helpers/matchers";

export const suspendAppealRestoreTest = async ({ browser }: { browser: Browser }) => {
    console.log("=== Suspend-Appeal-Restore Flow Test ===");

    // 1. Create a new user to be suspended
    const username = newTestUsername("AppealUser");
    console.log(`Creating test user: ${username}`);
    const { userPage, userContext } = await prepareNewUser(browser, username, "test");
    console.log(`User created: ${username} ✓`);

    // 2. Set up seeded moderator
    console.log("Setting up moderator account...");
    const moderatorPassword = process.env.E2E_MODERATOR_PASSWORD;
    if (!moderatorPassword) {
        throw new Error("E2E_MODERATOR_PASSWORD environment variable must be set to run this test");
    }

    const uniqueIPv6 = generateUniqueTestIPv6();
    const modContext = await browser.newContext({
        extraHTTPHeaders: {
            "X-Forwarded-For": uniqueIPv6,
        },
    });
    const modPage = await modContext.newPage();

    await loginAsUser(modPage, "E2E_MODERATOR", moderatorPassword);
    await turnOffDynamicHelp(modPage);
    console.log("Moderator logged in ✓");

    // 3. Moderator suspends the user
    console.log(`Moderator suspending user: ${username}`);

    // Navigate to the user's profile using OmniSearch
    await goToUsersProfile(modPage, username);
    console.log("Navigated to user profile ✓");

    // Click on the player link to open the PlayerDetails popover
    // Use .first() since there may be multiple Player links on the page (header, content, etc.)
    const playerLink = modPage.locator(`a.Player:has-text("${username}")`).first();
    await expect(playerLink).toBeVisible();
    await playerLink.hover();
    await playerLink.click();
    console.log("Opened player details popover ✓");

    // Click the Suspend button in the popover
    const suspendButton = await expectOGSClickableByName(modPage, /Suspend/);
    await suspendButton.click();
    console.log("Clicked Suspend button ✓");

    // Wait for BanModal to appear
    await expect(modPage.locator(".BanModal")).toBeVisible();
    console.log("Ban modal opened ✓");

    // Fill in the public reason (first textarea in modal)
    const publicReasonTextarea = modPage.locator(".BanModal textarea").first();
    await publicReasonTextarea.fill("Test suspension for e2e testing");
    await expect(publicReasonTextarea).toHaveValue("Test suspension for e2e testing");
    console.log("Filled suspension reason ✓");

    // Click the Suspend button in the modal
    const confirmSuspendButton = await expectOGSClickableByName(modPage, /^Suspend$/);
    await confirmSuspendButton.click();
    console.log("Confirmed suspension ✓");

    // Wait for the modal to close as confirmation
    await expect(modPage.locator(".BanModal")).toBeHidden();
    console.log("User suspended successfully ✓");

    // Give the server a moment to process
    await modPage.waitForTimeout(500);

    // 4. User sees suspension banner
    console.log("Checking for suspension banner on user page...");
    await userPage.goto("/");
    await userPage.waitForLoadState("networkidle");

    await expect(userPage.getByText("Your account has been suspended")).toBeVisible();
    console.log("Suspension banner visible ✓");

    // 5. User clicks appeal link
    console.log("User clicking appeal link...");
    const appealLink = userPage.getByRole("link", { name: /appeal here/i });
    await expect(appealLink).toBeVisible();
    await appealLink.click();
    await userPage.waitForLoadState("networkidle");

    // Verify we're on the appeal page
    await expect(userPage.getByText(/Your account has been suspended/i)).toBeVisible();
    await expect(
        userPage.getByText(/Reason for suspension: Test suspension for e2e testing/i),
    ).toBeVisible();
    console.log("Appeal page loaded ✓");

    // 6. User submits appeal message
    console.log("User submitting appeal...");
    const appealTextarea = userPage.locator(".input-card textarea");
    await expect(appealTextarea).toBeVisible();
    await appealTextarea.fill("I apologize for my behavior. I understand the rules now.");
    await expect(appealTextarea).toHaveValue(
        "I apologize for my behavior. I understand the rules now.",
    );

    const userSubmitButton = await expectOGSClickableByName(userPage, /^Submit$/);
    await userSubmitButton.click();
    console.log("Appeal submitted ✓");

    // Verify the message appears in the UI
    await expect(
        userPage.getByText(/I apologize for my behavior. I understand the rules now./i),
    ).toBeVisible();
    console.log("Appeal message visible in UI ✓");

    // 7. Moderator goes to Appeals Centre
    console.log("Moderator navigating to Appeals Centre...");
    await modPage.goto("/appeals-center");
    await modPage.waitForLoadState("networkidle");

    // Verify we're on the Appeals Center page by checking for the h1 heading
    await expect(modPage.getByRole("heading", { name: /Appeals Center/i })).toBeVisible();
    console.log("Appeals Centre loaded ✓");

    // 8. Find and click on the user's appeal
    console.log(`Looking for appeal from ${username}...`);
    // Find the row containing the username, then click on a non-Player cell
    // (AppealsCenter has special logic to avoid navigation when clicking Player component)
    const appealRow = modPage.locator(".PaginatedTable tr", { hasText: username });
    await expect(appealRow).toBeVisible();

    // Click on the "State" column cell (not the Player cell)
    const stateCell = appealRow.locator("td.state").last();
    await stateCell.click();
    await modPage.waitForLoadState("networkidle");
    console.log("Appeal opened ✓");

    // 9. Verify moderator sees the appeal message
    console.log("Verifying appeal message is visible...");
    await expect(modPage.getByText(/I apologize for my behavior/i)).toBeVisible();
    console.log("Appeal message visible to moderator ✓");

    // 10. Moderator responds but leaves user suspended
    console.log("Moderator responding (leaving suspended)...");
    const modTextarea = modPage.locator(".input-card textarea");
    await expect(modTextarea).toBeVisible();
    await modTextarea.fill("Please review the Terms of Service and do not repeat this behavior.");
    await expect(modTextarea).toHaveValue(
        "Please review the Terms of Service and do not repeat this behavior.",
    );

    const leaveSuspendedButton = await expectOGSClickableByName(modPage, /Leave Suspended/);
    await expect(leaveSuspendedButton).toBeVisible();
    await leaveSuspendedButton.click();
    console.log("Moderator response sent (user still suspended) ✓");

    // Verify the message appears in the UI
    await expect(
        modPage.getByText(/Please review the Terms of Service and do not repeat this behavior/i),
    ).toBeVisible();
    console.log("Moderator message visible in UI ✓");

    // 11. User sees moderator's response
    console.log("User checking for moderator response...");
    await userPage.reload();
    await userPage.waitForLoadState("networkidle");

    await expect(
        userPage.getByText(/Please review the Terms of Service and do not repeat this behavior/i),
    ).toBeVisible();
    console.log("User sees moderator response ✓");

    // 12. User replies to moderator
    console.log("User replying to moderator...");
    const userReplyTextarea = userPage.locator(".input-card textarea");
    await userReplyTextarea.fill(
        "Thank you for the second chance. I have read the Terms and will follow them.",
    );
    await expect(userReplyTextarea).toHaveValue(
        "Thank you for the second chance. I have read the Terms and will follow them.",
    );

    const userReplyButton = await expectOGSClickableByName(userPage, /^Submit$/);
    await userReplyButton.click();
    console.log("User reply sent ✓");

    // Verify the message appears in the UI
    await expect(
        userPage.getByText(/Thank you for the second chance. I have read the Terms/i),
    ).toBeVisible();
    console.log("User reply visible in UI ✓");

    // 13. Moderator sees reply and restores account
    console.log("Moderator checking for user reply...");
    await modPage.reload();
    await modPage.waitForLoadState("networkidle");

    await expect(
        modPage.getByText(/Thank you for the second chance. I have read the Terms/i),
    ).toBeVisible();
    console.log("Moderator sees user reply ✓");

    // 14. Moderator sends final message and restores account
    console.log("Moderator restoring account...");
    const finalTextarea = modPage.locator(".input-card textarea");
    await finalTextarea.fill("Account restored. Welcome back to OGS!");
    await expect(finalTextarea).toHaveValue("Account restored. Welcome back to OGS!");

    const restoreButton = await expectOGSClickableByName(modPage, /Restore Account/);
    await expect(restoreButton).toBeVisible();
    await restoreButton.click();
    console.log("Restore Account button clicked ✓");

    // Verify the message appears and account is restored
    await expect(modPage.getByText(/Account restored. Welcome back to OGS!/i)).toBeVisible();
    console.log("Final message visible ✓");

    // Wait a moment for backend to process restoration
    await modPage.waitForTimeout(1000);

    // 15. Verify user no longer sees suspension banner
    console.log("Verifying suspension banner is removed...");
    await userPage.goto("/");
    await userPage.waitForLoadState("networkidle");

    await expect(userPage.getByText("Your account has been suspended")).not.toBeVisible();
    console.log("Suspension banner removed ✓");

    // Verify the "Ban has been lifted" message appears in the appeal page for moderator
    await modPage.reload();
    await expect(modPage.getByText(/Ban has been lifted/i)).toBeVisible();
    console.log("Moderator sees 'Ban has been lifted' message ✓");

    // 16. TODO: Verify user received system PM
    // The PM functionality is implemented and working, but e2e verification needs investigation
    // of the best way to check for system PMs in the UI.
    console.log("TODO: Verify user received system PM with final message");

    // Clean up
    await userPage.close();
    await userContext.close();
    await modPage.close();
    await modContext.close();

    console.log("=== Suspend-Appeal-Restore Flow Test Complete ===");
    console.log("✓ User suspended by moderator");
    console.log("✓ User saw suspension banner and appeal link");
    console.log("✓ User submitted appeal");
    console.log("✓ Moderator saw appeal in Appeals Centre");
    console.log("✓ Moderator responded while leaving user suspended");
    console.log("✓ User saw moderator response and replied");
    console.log("✓ Moderator restored account with 'Restore Account' button");
    console.log("✓ Suspension banner removed after restoration");
    console.log("⚠ TODO: System PM verification");
};
