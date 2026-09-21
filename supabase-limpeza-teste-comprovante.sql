-- ============================================================
-- Limpeza da venda de teste feita pra validar o novo layout do
-- comprovante (cliente "Cliente Teste Comprovante", CPF de teste
-- 529.982.247-25, 2x Theros, R$ 160,00, pago no cartão). Roda
-- isso no SQL Editor do Supabase quando quiser tirar do sistema.
-- ============================================================

delete from order_payments where order_id in (select id from orders where customer_id in (select id from customers where doc_number = '52998224725'));
delete from order_items where order_id in (select id from orders where customer_id in (select id from customers where doc_number = '52998224725'));
delete from orders where customer_id in (select id from customers where doc_number = '52998224725');
delete from customers where doc_number = '52998224725';
