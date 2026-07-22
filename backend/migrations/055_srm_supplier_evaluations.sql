CREATE TABLE supplier_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    auto_on_time_pct NUMERIC(5,2),
    auto_qty_accuracy_pct NUMERIC(5,2),
    auto_return_rate_pct NUMERIC(5,2),
    auto_score NUMERIC(3,2),
    manual_quality INTEGER CHECK (manual_quality BETWEEN 1 AND 5),
    manual_communication INTEGER CHECK (manual_communication BETWEEN 1 AND 5),
    manual_flexibility INTEGER CHECK (manual_flexibility BETWEEN 1 AND 5),
    manual_score NUMERIC(3,2),
    final_score NUMERIC(3,2),
    evaluator_id UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE supplier_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to supplier_evaluations" ON supplier_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_supplier_evaluations_supplier ON supplier_evaluations(supplier_id);
