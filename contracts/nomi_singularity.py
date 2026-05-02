# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing


class NomiSingularity(gl.Contract):
    evaluations: TreeMap[str, str]
    latest_evaluation_id: str

    def __init__(self):
        self.evaluations = TreeMap[str, str]()
        self.latest_evaluation_id = ""

    @gl.public.write
    def select_winner(self, evaluation_id: str, candidates_json: typing.Any) -> str:
        if evaluation_id == "":
            raise gl.vm.UserError("evaluation_id is required")

        if self.evaluations.get(evaluation_id, "") != "":
            raise gl.vm.UserError("evaluation already exists")

        candidates_payload = self._validate_candidates_payload(candidates_json)
        candidates_payload_json = json.dumps(candidates_payload, sort_keys=True)

        task = """
Select exactly one Nomi Singularity winner from the provided Discord community
candidate payload.

The award is monthly and only applies to users with the Brain role.
The winner should be the candidate with the strongest genuine contribution,
not simply the largest raw message count.

Return strict JSON only with this schema:
{
  "winner_user_id": "discord user id string",
  "confidence": 0-100 integer,
  "decision": "award" or "no_eligible_candidate",
  "reason": "short explanation",
  "risk_notes": ["short note", "..."]
}
"""

        criteria = """
The output must be valid JSON and must follow the requested schema.
The winner_user_id must either match one candidate user_id from the input or be
an empty string when decision is no_eligible_candidate.
The decision must be award only when the chosen user:
- has role Brain or has_brain_role true
- is not marked Purge Risk or Critical
- has meaningful_messages >= 100
- has low spam and low-effort signals
- shows clear GenLayer focus
- has consistent activity across the month

The model must prefer verified contribution signals such as weekly project
posts, official contest recognition, approved X submissions, builder proofs,
and admin bonus over raw message volume.

The model must reject point farming, duplicate/copy-paste behavior, low-effort
AI-generated content, and users with unclear GenLayer alignment.

The confidence must be an integer from 0 to 100.
The reason must be concise and based only on the provided input.
"""

        def leader_fn():
            response = gl.nondet.exec_prompt(
                task + "\n\nCriteria:\n" + criteria + "\n\nInput JSON:\n" + candidates_payload_json
            )
            return self._parse_json_response(response)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            validator_data = leader_fn()
            leader_data = leader_result.calldata

            return self._winner_result_matches(leader_data, validator_data)

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        normalized = self._normalize_result(json.dumps(result), candidates_payload)
        self.evaluations[evaluation_id] = normalized
        self.latest_evaluation_id = evaluation_id
        return normalized

    @gl.public.write
    def evaluate_post(self, evaluation_id: str, post_json: typing.Any) -> str:
        if evaluation_id == "":
            raise gl.vm.UserError("evaluation_id is required")

        if self.evaluations.get(evaluation_id, "") != "":
            raise gl.vm.UserError("evaluation already exists")

        post_payload = self._validate_json_object(post_json, "post payload must be a JSON object")
        post_payload_json = json.dumps(post_payload, sort_keys=True)

        task = """
Evaluate whether this Discord/X/community contribution should count as a
high-quality GenLayer contribution.

Return strict JSON only with this schema:
{
  "decision": "approve" or "reject" or "needs_admin_review",
  "quality_score": 0-100 integer,
  "originality_score": 0-100 integer,
  "genlayer_focus_score": 0-100 integer,
  "spam_risk": 0-100 integer,
  "reason": "short explanation"
}
"""

        criteria = """
The output must be valid JSON and must follow the requested schema.
Approve only if the contribution is original, thoughtful, clearly related to
GenLayer, and not low-effort AI-generated content.
Reject duplicate, generic hype, spam, copy-paste, off-topic, or very shallow
content.
Use needs_admin_review for ambiguous cases.
All scores must be integers from 0 to 100.
The reason must be concise and based only on the provided input.
"""

        def leader_fn():
            response = gl.nondet.exec_prompt(
                task + "\n\nCriteria:\n" + criteria + "\n\nInput JSON:\n" + post_payload_json
            )
            return self._parse_json_response(response)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            validator_data = leader_fn()
            leader_data = leader_result.calldata

            return self._post_result_matches(leader_data, validator_data)

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        normalized = self._normalize_post_result(json.dumps(result))
        self.evaluations[evaluation_id] = normalized
        self.latest_evaluation_id = evaluation_id
        return normalized

    @gl.public.view
    def get_evaluation(self, evaluation_id: str) -> str:
        return self.evaluations.get(evaluation_id, "")

    @gl.public.view
    def get_latest_evaluation_id(self) -> str:
        return self.latest_evaluation_id

    @gl.public.view
    def get_all_evaluations(self) -> dict[str, str]:
        return {k: v for k, v in self.evaluations.items()}

    def _validate_candidates_payload(self, payload: typing.Any) -> typing.Any:
        data = self._validate_json_object(payload, "candidates payload must be a JSON object")
        candidates = data.get("candidates", [])

        if not isinstance(candidates, list):
            raise gl.vm.UserError("candidates must be a list")

        if len(candidates) == 0:
            raise gl.vm.UserError("at least one candidate is required")

        if len(candidates) > 10:
            raise gl.vm.UserError("too many candidates; send top 10 or fewer")

        for candidate in candidates:
            if not isinstance(candidate, dict):
                raise gl.vm.UserError("each candidate must be a JSON object")
            if str(candidate.get("user_id", "")) == "":
                raise gl.vm.UserError("each candidate must include user_id")

        return data

    def _validate_json_object(self, payload: typing.Any, error_message: str) -> typing.Any:
        if isinstance(payload, dict):
            data = payload
        else:
            try:
                data = json.loads(str(payload))
            except Exception:
                raise gl.vm.UserError("invalid JSON")

        if not isinstance(data, dict):
            raise gl.vm.UserError(error_message)

        return data

    def _parse_json_response(self, response: str) -> typing.Any:
        text = str(response).strip()
        if text.startswith("```"):
            first_newline = text.find("\n")
            if first_newline >= 0:
                text = text[first_newline + 1:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        try:
            return json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                return json.loads(text[start:end + 1])
            raise

    def _normalize_result(self, result: str, input_data: typing.Any) -> str:
        result_data = self._validate_json_object(str(result), "result must be a JSON object")

        allowed_ids = {}
        for candidate in input_data.get("candidates", []):
            allowed_ids[str(candidate.get("user_id", ""))] = True

        decision = str(result_data.get("decision", ""))
        winner_user_id = str(result_data.get("winner_user_id", ""))

        if decision not in ["award", "no_eligible_candidate"]:
            raise gl.vm.UserError("invalid decision")

        if decision == "award" and winner_user_id not in allowed_ids:
            raise gl.vm.UserError("winner_user_id is not in candidates")

        if decision == "no_eligible_candidate":
            winner_user_id = ""

        normalized = {
            "winner_user_id": winner_user_id,
            "confidence": self._clamp_score(result_data.get("confidence", 0)),
            "decision": decision,
            "reason": str(result_data.get("reason", ""))[:600],
            "risk_notes": self._normalize_string_list(result_data.get("risk_notes", []), 5),
        }

        return json.dumps(normalized, sort_keys=True)

    def _winner_result_matches(self, leader_data: typing.Any, validator_data: typing.Any) -> bool:
        if not isinstance(leader_data, dict) or not isinstance(validator_data, dict):
            return False

        if str(leader_data.get("decision", "")) != str(validator_data.get("decision", "")):
            return False

        if str(leader_data.get("winner_user_id", "")) != str(validator_data.get("winner_user_id", "")):
            return False

        leader_confidence = self._clamp_score(leader_data.get("confidence", 0))
        validator_confidence = self._clamp_score(validator_data.get("confidence", 0))

        return abs(int(leader_confidence) - int(validator_confidence)) <= 20

    def _normalize_post_result(self, result: str) -> str:
        data = self._validate_json_object(str(result), "result must be a JSON object")
        decision = str(data.get("decision", ""))

        if decision not in ["approve", "reject", "needs_admin_review"]:
            raise gl.vm.UserError("invalid post decision")

        normalized = {
            "decision": decision,
            "quality_score": self._clamp_score(data.get("quality_score", 0)),
            "originality_score": self._clamp_score(data.get("originality_score", 0)),
            "genlayer_focus_score": self._clamp_score(data.get("genlayer_focus_score", 0)),
            "spam_risk": self._clamp_score(data.get("spam_risk", 100)),
            "reason": str(data.get("reason", ""))[:600],
        }

        return json.dumps(normalized, sort_keys=True)

    def _post_result_matches(self, leader_data: typing.Any, validator_data: typing.Any) -> bool:
        if not isinstance(leader_data, dict) or not isinstance(validator_data, dict):
            return False

        if str(leader_data.get("decision", "")) != str(validator_data.get("decision", "")):
            return False

        score_fields = [
            "quality_score",
            "originality_score",
            "genlayer_focus_score",
            "spam_risk",
        ]

        for field in score_fields:
            leader_score = self._clamp_score(leader_data.get(field, 0))
            validator_score = self._clamp_score(validator_data.get(field, 0))
            if abs(int(leader_score) - int(validator_score)) > 20:
                return False

        return True

    def _clamp_score(self, value: typing.Any) -> u32:
        try:
            number = int(value)
        except Exception:
            number = 0

        if number < 0:
            number = 0
        if number > 100:
            number = 100

        return u32(number)

    def _normalize_string_list(self, value: typing.Any, limit: int) -> list[str]:
        if not isinstance(value, list):
            return []

        result = []
        for item in value:
            if len(result) >= limit:
                break
            result.append(str(item)[:240])

        return result
