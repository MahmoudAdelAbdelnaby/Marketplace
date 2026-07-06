from sqlmodel import Field
class Test:
    id: int = Field(default=None, primary_key=True)
print(Test.__annotations__)
