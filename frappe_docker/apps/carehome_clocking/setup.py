from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

setup(
    name="carehome_clocking",
    version="1.0.0",
    description="QR-based clocking system for care homes",
    author="CareHome Systems",
    author_email="support@carehome.example.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
