-- Resume Battle, rebuilt as a share-link comparison rather than two dropdowns
-- against your own Vault.
--
-- A logged-in creator picks one of their own resumes and gets a token/link.
-- Anyone with the link (no account required) can upload a resume to challenge
-- it. Both sides are scored with the same general (no-job) roast pipeline and
-- snapshotted here at the moment each side submits — not re-derived from a
-- live resume, so a challenger's upload never needs to be kept around after
-- scoring (see BattleService: no Resume row is ever created for them).
CREATE TABLE battle_challenges (
    id                      UUID PRIMARY KEY,
    token                   VARCHAR(24) NOT NULL,
    creator_user_id         UUID NOT NULL REFERENCES users(id),
    creator_resume_id       UUID NOT NULL REFERENCES resumes(id),
    creator_label           VARCHAR(120) NOT NULL,
    creator_top_dog_rank    SMALLINT NOT NULL,
    creator_tier_name       VARCHAR(32) NOT NULL,
    creator_sub_scores      JSONB NOT NULL,
    challenger_label        VARCHAR(120),
    challenger_top_dog_rank SMALLINT,
    challenger_tier_name    VARCHAR(32),
    challenger_sub_scores   JSONB,
    -- WAITING until a challenger submits, then COMPLETE. A token only ever
    -- accepts one challenger — see BattleService.submitChallenge.
    status                  VARCHAR(16) NOT NULL DEFAULT 'WAITING',
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL,
    updated_at              TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX idx_battle_challenges_token ON battle_challenges (token);
CREATE INDEX idx_battle_challenges_creator_user_id ON battle_challenges (creator_user_id);
