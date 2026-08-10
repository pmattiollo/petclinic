package victor.training.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.data.domain.Page;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.PageDto;

import java.util.List;

@Mapper(componentModel = "spring", uses = PetMapper.class)
public interface OwnerMapper {

    OwnerDto toOwnerDto(Owner owner);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "pets", ignore = true)
    Owner toOwner(OwnerFieldsDto ownerDto);

    List<OwnerDto> toOwnerDtoCollection(List<Owner> ownerCollection);

    default PageDto<OwnerDto> toOwnerPageDto(Page<Owner> ownerPage) {
        return new PageDto<>(toOwnerDtoCollection(ownerPage.getContent()), ownerPage.getTotalElements(),
                ownerPage.getTotalPages(), ownerPage.getNumber(), ownerPage.getSize());
    }

}
