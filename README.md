# GenLayer Discord Contribution Monitor

Tai lieu thiet ke he thong bot Discord giam sat dong gop cong dong GenLayer, canh bao rui ro ha role, va de xuat Nomi Singularity hang thang.

## Documents

- [System Design](docs/genlayer-discord-monitoring-system.md)
- [GenLayer Contract](docs/genlayer-contract.md)
- [Build and Run Guide](docs/build-and-run.md)
- [Project Structure Image](docs/project-structure.svg)

## Scope

He thong duoc thiet ke de:

- Theo doi hoat dong Discord theo ngay, tuan, thang.
- Tinh meaningful messages cho role Brain.
- Theo doi bai viet chat luong cao cho role Neurocreative.
- Theo doi muc do tap trung vao GenLayer va dong gop X/Discord cho role Singularity.
- Canh bao admin khi user sap khong dat dieu kien giu role.
- Chon 1 Brain noi bat nhat thang qua lenh `/nomi_singularity`.
- Dung GenLayer lam lop danh gia chat luong/focus/originality cho cac case quan trong.

## Contract

- `contracts/nomi_singularity.py`

Contract nay nhan candidate summary tu backend va dung GenLayer de chon winner cho `/nomi_singularity`, hoac danh gia chat luong tung post/proof quan trong.
