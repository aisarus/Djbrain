export function proposeSemanticFacts(episodes, options = {}) {
  if (!Array.isArray(episodes)) throw new TypeError('episodes must be an array');
  const minSupport = options.minSupport ?? 2;
  const groups = new Map();

  for (const episode of episodes) {
    for (const entity of episode.entities ?? []) {
      const key = `${entity}:related_topic`;
      const current = groups.get(key) ?? { subject: entity, predicate: 'related_topic', values: new Map(), episodeIds: [] };
      for (const topic of episode.topics ?? []) current.values.set(topic, (current.values.get(topic) ?? 0) + 1);
      current.episodeIds.push(episode.id);
      groups.set(key, current);
    }
  }

  const proposals = [];
  for (const group of groups.values()) {
    for (const [value, support] of group.values) {
      if (support < minSupport) continue;
      proposals.push({
        schemaVersion: '1.0.0',
        id: `proposal_${crypto.randomUUID()}`,
        operation: 'insert_semantic_fact',
        subject: group.subject,
        predicate: group.predicate,
        value,
        evidenceIds: group.episodeIds,
        supportCount: support,
        confidence: Math.min(0.9, 0.45 + support * 0.1),
        approvalStatus: 'pending',
        risk: support < 3 ? 'medium' : 'low'
      });
    }
  }
  return proposals;
}

export function detectProposalConflicts(proposals, semanticStore) {
  return proposals.map((proposal) => {
    const conflicts = semanticStore.facts
      .filter((fact) => fact.subject === proposal.subject && fact.predicate === proposal.predicate)
      .filter((fact) => JSON.stringify(fact.value) !== JSON.stringify(proposal.value))
      .map((fact) => fact.id);
    return { ...proposal, conflictIds: conflicts, risk: conflicts.length ? 'high' : proposal.risk };
  });
}
