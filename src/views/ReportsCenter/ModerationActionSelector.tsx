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

import * as React from "react";
import { _, llm_pgettext } from "@/lib/translate";

import * as DynamicHelp from "react-dynamic-help";
import { useUser } from "@/lib/hooks";
import { Report } from "@/lib/report_util";

interface ModerationActionSelectorProps {
    available_actions: string[];
    vote_counts: { [action: string]: number };
    enable: boolean;
    report: Report;
    submit: (action: string, note: string, dissenter_note: string) => void;
}

// Translatable versions of the prompts for Community Moderators.
// The set of keys (choices) here is determined by the server's VotableActions class.
//
// Don't forget to update rest_api.warnings.WarningMessageId as needed: new actions usually mean new messages.
const ACTION_PROMPTS = {
    annul_escaped: llm_pgettext(
        "Label for a moderator to select this option.  Be completely unambiguous with regards to the meaning of the word annul.",
        "Wrong result due to escape - annul game, warn the escaper.",
    ),
    warn_escaper: llm_pgettext(
        "Label for a moderator to select this option",
        "The accused escaped - warn them.",
    ),
    call_escaped_game_for_black: llm_pgettext(
        "Label for a moderator to select this option",
        "White escaped - call the game for black, and warn white.",
    ),
    call_escaped_game_for_white: llm_pgettext(
        "Label for a moderator to select this option",
        "Black escaped - call the game for white, and warn black.",
    ),
    no_escaping: llm_pgettext(
        "Label for a moderator to select this option",
        "No escaping evident - inform the reporter.",
    ),
    not_escaping_cancel: llm_pgettext(
        "Label for a moderator to select this option",
        "Not escaping, they used 'cancel'.",
    ),
    annul_stalled: llm_pgettext(
        "Label for a moderator to select this option",
        "Wrong result due to stalling - annul game, warn the staller.",
    ),
    warn_staller: llm_pgettext(
        "Label for a moderator to select this option",
        "The accused stalled - warn them.",
    ),
    call_stalled_game_for_black: llm_pgettext(
        "Label for a moderator to select this option",
        "White stalled - call the game for black, and warn white.",
    ),
    call_stalled_game_for_white: llm_pgettext(
        "Label for a moderator to select this option",
        "Black stalled - call the game for white, and warn black.",
    ),
    no_stalling: llm_pgettext(
        "Label for a moderator to select this option",
        "No stalling evident - inform the reporter.",
    ),
    annul_score_cheat: llm_pgettext(
        "Label for a moderator to select this option",
        "Annul the game and warn the cheater.",
    ),
    warn_score_cheat: llm_pgettext(
        "Label for a moderator to select this option",
        "The accused tried to cheat - warn the cheater.",
    ),
    no_score_cheat: llm_pgettext(
        "Label for a moderator to select this option",
        "No cheating - inform the reporter.",
    ),
    call_score_cheat_for_black: llm_pgettext(
        "Label for a moderator to select this option",
        "White is cheating - call the game for black, and warn white.",
    ),
    call_score_cheat_for_white: llm_pgettext(
        "Label for a moderator to select this option",
        "Black is cheating - call the game for white, and warn black.",
    ),
    annul_no_warning: llm_pgettext(
        "Label for a moderator to select this option",
        "Annul the game, but issue no warnings.",
    ),
    final_warning_escaping: llm_pgettext(
        "Label for a moderator to select this option",
        "Final warning: the accused escaped.",
    ),
    final_warning_stalling: llm_pgettext(
        "Label for a moderator to select this option",
        "Final warning: the accused stalled.",
    ),
    final_warning_score_cheating: llm_pgettext(
        "Label for a moderator to select this option",
        "Final warning: the accused tried to cheat.",
    ),
    final_warning_escaping_and_annul: llm_pgettext(
        "Label for a moderator to select this option",
        "Final warning: the accused escaped - annul game.",
    ),
    final_warning_stalling_and_annul: llm_pgettext(
        "Label for a moderator to select this option",
        "Final warning: the accused stalled - annul game.",
    ),
    final_warning_score_cheating_and_annul: llm_pgettext(
        "Label for a moderator to select this option",
        "Final warning: the accused tried to cheat - annul game.",
    ),
    warn_duplicate_reporter: llm_pgettext(
        "Label for a moderator to select this option",
        "Duplicate report - ask them not to do that.",
    ),

    suspend_user: llm_pgettext("Label for a moderator to select this option", "Suspend the user."),

    suspend_user_and_annul: llm_pgettext(
        "Label for a moderator to select this option",
        "Suspend user and annul game.",
    ),

    // Note: keep this last, so it's positioned above the "escalation note" input field
    escalate: llm_pgettext(
        "A label for a community moderator to select this option",
        "Escalate: report needs final warning or suspension, or other unusual action.",
    ),
};

export function ModerationActionSelector({
    available_actions,
    vote_counts,
    enable,
    report,
    submit,
}: ModerationActionSelectorProps): JSX.Element {
    const user = useUser();
    const reportedBySelf = user.id === report.reporting_user.id;

    const [voted, setVoted] = React.useState(false);

    const [selectedOption, setSelectedOption] = React.useState("");
    const [escalation_note, setEscalationNote] = React.useState("");
    const [dissenter_note, setDissenterNote] = React.useState("");

    const updateSelectedAction = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedOption(e.target.value);
    };

    const { registerTargetItem } = React.useContext(DynamicHelp.Api);
    const { ref: voting_pane } = registerTargetItem("voting-pane");
    const { ref: escalate_option } = registerTargetItem("escalate-option");

    // If for some reason we didn't get any actions to offer, we'll just offer "escalate"
    const action_choices = available_actions ? available_actions : ["escalate"];

    // If we're in dissent, we'll ask for a "dissent" note
    const inDissent =
        selectedOption &&
        !!Object.keys(vote_counts).find(
            (k: string) =>
                k !== selectedOption && (vote_counts[selectedOption] ?? 0) < vote_counts[k],
        );

    return (
        <div className="ModerationActionSelector" ref={voting_pane}>
            <h4>
                {llm_pgettext(
                    "The heading for community moderators 'action choices' section",
                    "Actions",
                )}
            </h4>
            {(!available_actions || null) && (
                <div className="no-report-actions-note">
                    {_("This report has no available actions yet.  You can escalate or ignore it.")}
                </div>
            )}
            {!enable && (
                <div className="disabled-actions-note">
                    {_("This report was handled after you decided to look at it!")}
                </div>
            )}
            {enable &&
                action_choices.map((a) => (
                    <div
                        key={a}
                        className="action-selector"
                        ref={a === "escalate" ? escalate_option : null}
                    >
                        <input
                            id={a}
                            name="availableActions"
                            type="radio"
                            checked={selectedOption === a}
                            value={a}
                            onChange={updateSelectedAction}
                        />
                        <label htmlFor={a}>
                            {(ACTION_PROMPTS as any)[a]}
                            <span className="vote-count">
                                ({(!!a && !!vote_counts && vote_counts[a]) ?? 0})
                            </span>
                        </label>
                    </div>
                ))}
            {selectedOption === "escalate" && (
                <textarea
                    id="escalation-note"
                    placeholder={llm_pgettext(
                        "A placeholder prompting community moderators for the reason why they are escalating a report",
                        "Reason for escalating?",
                    )}
                    rows={5}
                    value={escalation_note}
                    onChange={(ev) => setEscalationNote(ev.target.value)}
                />
            )}
            {inDissent && selectedOption !== "escalate" && (
                <textarea
                    id="dissenter-note"
                    placeholder={llm_pgettext(
                        "A placeholder prompting community moderators for the reason why they are disagreeing with a vote",
                        "(Optional) What is it that the other votes do not seem to take into account?",
                    )}
                    rows={5}
                    value={dissenter_note}
                    onChange={(ev) => setDissenterNote(ev.target.value)}
                />
            )}
            <span className="action-buttons">
                {((reportedBySelf && enable) || null) && (
                    <button className="reject" onClick={report.cancel}>
                        {llm_pgettext(
                            "A button for cancelling a report created by yourself",
                            "Cancel Report",
                        )}
                    </button>
                )}
                {((action_choices && enable) || null) && (
                    <button
                        className="success"
                        disabled={
                            voted ||
                            !selectedOption ||
                            (selectedOption === "escalate" && !escalation_note)
                        }
                        onClick={() => {
                            setVoted(true);
                            submit(selectedOption, escalation_note, dissenter_note);
                        }}
                    >
                        {llm_pgettext("A label on a button for submitting a vote", "Vote")}
                    </button>
                )}
            </span>
        </div>
    );
}
